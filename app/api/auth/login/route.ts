import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { verifyPassword } from "@/lib/security/password";
import { rateLimit, getClientIp } from "@/lib/security/rate-limit";
import { loginSchema } from "@/lib/validation/auth";
import { createSession, setSessionCookie } from "@/lib/auth/session";
import {
  isAccountLocked,
  recordFailedLogin,
  resetFailedLogins,
} from "@/lib/auth/lockout";
import { logAuditEvent } from "@/lib/audit";
import { AppError, errorResponse } from "@/lib/errors";

// For seller_individual / seller_business users, look up their Seller row
// once at login so sellerId can be embedded in the session payload — every
// later request then has it for free, without a DB lookup per request.
// Returns undefined for non-seller roles (and, defensively, if a seller
// role somehow has no Seller row yet — that shouldn't happen, but a
// missing sellerId should never be silently treated as the system seller
// or any other seller).
async function getSellerIdForUser(userId: string, role: string): Promise<string | undefined> {
  if (role !== "seller_individual" && role !== "seller_business") return undefined;
  const seller = await prisma.seller.findUnique({
    where: { userId },
    select: { id: true },
  });
  return seller?.id;
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const userAgent = req.headers.get("user-agent");

  try {
    const { allowed, retryAfterSeconds } = await rateLimit(`login:${ip}`, 10, 60);
    if (!allowed) {
      throw new AppError("RATE_LIMIT_EXCEEDED", { retryAfterSeconds });
    }

    const body = await req.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError("VALIDATION_ERROR", parsed.error.flatten());
    }
    const { emailOrUsername, password } = parsed.data;

    const isEmail = emailOrUsername.includes("@");
    let user;
    if (isEmail) {
      user = await prisma.user.findUnique({ where: { email: emailOrUsername } });
    } else {
      user = await prisma.user.findUnique({ where: { username: emailOrUsername } });
    }
    // Always run a password comparison even if user doesn't exist,
    // so response timing doesn't reveal whether the email is registered.
    const passwordMatches = user
      ? await verifyPassword(password, user.password)
      : await verifyPassword(password, "$2a$12$invalidinvalidinvalidinvalidinvalidinv");

    // Check lockout FIRST before revealing password result
    if (user && (await isAccountLocked(user.id))) {
      throw new AppError("AUTH_ACCOUNT_LOCKED");
    }

    if (!user || !passwordMatches) {
      if (user) {
        await recordFailedLogin(user.id);
        await logAuditEvent({
          userId: user.id,
          action: "auth.login_failed",
          resourceType: "user",
          resourceId: user.id,
          ipAddress: ip,
          userAgent,
        });
      }
      throw new AppError("AUTH_INVALID_CREDENTIALS");
    }

    if (!user.emailVerified) {
      throw new AppError("AUTH_EMAIL_NOT_VERIFIED");
    }

    await resetFailedLogins(user.id);

    // Admin accounts must complete 2FA before the session is fully trusted.
    if (user.role === "admin" && user.twoFactorEnabled) {
      const sellerId = await getSellerIdForUser(user.id, user.role);
      const tempToken = await createSession({
        userId: user.id,
        email: user.email,
        role: user.role,
        twoFactorVerified: false,
        sellerId,
      });
      await setSessionCookie(tempToken, user.role);

      await logAuditEvent({
        userId: user.id,
        action: "auth.login_pending_2fa",
        resourceType: "user",
        resourceId: user.id,
        ipAddress: ip,
        userAgent,
      });

      return Response.json({
        requiresTwoFactor: true,
        message: "Please enter your authenticator code to continue.",
      });
    }

    const sellerId = await getSellerIdForUser(user.id, user.role);
    const token = await createSession({
      userId: user.id,
      email: user.email,
      role: user.role,
      twoFactorVerified: !user.twoFactorEnabled,
      sellerId,
    });
    await setSessionCookie(token, user.role);

    await logAuditEvent({
      userId: user.id,
      action: "auth.login_success",
      resourceType: "user",
      resourceId: user.id,
      ipAddress: ip,
      userAgent,
    });

    return Response.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        sellerId,
      },
      // Admins without 2FA enabled yet must set it up before they can
      // reach any /admin/* page, since middleware requires a verified
      // 2FA session flag. The frontend uses this to route correctly
      // instead of sending them to a page that will reject them.
      requiresTwoFactorSetup: user.role === "admin" && !user.twoFactorEnabled,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
