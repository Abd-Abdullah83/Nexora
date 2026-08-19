import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET || "dev-only-fallback-secret-change-me"
);

const CSRF_SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function generateCsrfToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const response = NextResponse.next();

  // ── CSRF protection ────────────────────────────────────────────────────
  // Skip for safe methods and for the Next.js internal routes.
  if (
    !CSRF_SAFE_METHODS.has(req.method) &&
    pathname.startsWith("/api/") &&
    !pathname.startsWith("/api/auth/login") &&   // login posts before cookie exists
    !pathname.startsWith("/api/auth/register") &&  // same for register
    !pathname.startsWith("/api/auth/2fa")          // 2FA already session-protected
  ) {
    const cookieToken = req.cookies.get("csrf_token")?.value;
    const headerToken = req.headers.get("x-csrf-token");

    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
      return NextResponse.json({ error: "CSRF_INVALID" }, { status: 403 });
    }
  }

  // Rotate / set CSRF token cookie on every GET so client always has one.
  if (req.method === "GET") {
    const existing = req.cookies.get("csrf_token")?.value;
    if (!existing) {
      const token = generateCsrfToken();
      response.cookies.set("csrf_token", token, {
        httpOnly: false,   // JS must read this to put it in the header
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24, // 24h
      });
    }
  }

  // ── Admin route guard ──────────────────────────────────────────────────
  if (pathname.startsWith("/admin")) {
    const token = req.cookies.get("session_token")?.value;

    if (!token) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    try {
      const { payload } = await jwtVerify(token, SECRET);
      const session = payload as { role?: string; twoFactorVerified?: boolean };

      if (session.role !== "admin" || !session.twoFactorVerified) {
        return NextResponse.redirect(new URL("/login", req.url));
      }
    } catch {
      return NextResponse.redirect(new URL("/login", req.url));
    }
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/api/:path*"],
};