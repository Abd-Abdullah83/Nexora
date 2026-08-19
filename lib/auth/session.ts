import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redis } from "@/lib/db/redis";

const SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET || "dev-only-fallback-secret-change-me"
);

const SESSION_COOKIE = "session_token";
const CUSTOMER_SESSION_HOURS = 24;
const ADMIN_SESSION_HOURS = 4;
// Sellers handle financial/inventory data, so they get the shorter,
// admin-tier session window rather than the longer customer default.
// (Not specified in the Phase 1 doc; flagged here as a deliberate choice
// rather than an accidental fallthrough to the customer default.)
const SELLER_SESSION_HOURS = ADMIN_SESSION_HOURS;

export type UserRole = "customer" | "admin" | "seller_individual" | "seller_business";

function sessionHoursForRole(role: UserRole): number {
  if (role === "admin") return ADMIN_SESSION_HOURS;
  if (role === "seller_individual" || role === "seller_business") return SELLER_SESSION_HOURS;
  return CUSTOMER_SESSION_HOURS;
}

export interface SessionPayload {
  userId: string;
  email: string;
  role: UserRole;
  twoFactorVerified?: boolean;
  // Present only when role is seller_individual or seller_business.
  // Populated at session-creation time (login) by looking up the user's
  // Seller row, so every later request can authorize seller-scoped data
  // access without an extra DB lookup per request.
  sellerId?: string;
}

export async function createSession(payload: SessionPayload): Promise<string> {
  const hours = sessionHoursForRole(payload.role);
  const expiresAt = Math.floor(Date.now() / 1000) + hours * 60 * 60;

  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(SECRET);

  // Track active session in Redis so logout / invalidation works server-side.
  await redis.set(`session:${token}`, payload.userId, "EX", hours * 60 * 60);

  return token;
}

export async function setSessionCookie(token: string, role: UserRole) {
  const hours = sessionHoursForRole(role);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: hours * 60 * 60,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const stillActive = await redis.get(`session:${token}`);
    if (!stillActive) return null;

    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function invalidateSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await redis.del(`session:${token}`);
  }
  await clearSessionCookie();
}

export { SESSION_COOKIE };
