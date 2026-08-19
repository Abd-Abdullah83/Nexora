import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSession, createSession, setSessionCookie } from "@/lib/auth/session";
import { verifyTotpCode } from "@/lib/auth/totp";
import { rateLimit, getClientIp } from "@/lib/security/rate-limit";
import { totpSetupVerifySchema } from "@/lib/validation/auth";
import { logAuditEvent } from "@/lib/audit";
import { AppError, errorResponse } from "@/lib/errors";

// See app/api/auth/login/route.ts for why this lookup happens at
// session-creation time rather than being read from the (now-stale)
// pre-2FA session payload.
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

  try {
    const { allowed, retryAfterSeconds } = await rateLimit(`2fa:${ip}`, 10, 60);
    if (!allowed) {
      throw new AppError("RATE_LIMIT_EXCEEDED", { retryAfterSeconds });
    }

    const session = await getSession();
    if (!session) {
      throw new AppError("AUTH_2FA_REQUIRED");
    }

    const body = await req.json();
    const parsed = totpSetupVerifySchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError("VALIDATION_ERROR", parsed.error.flatten());
    }
    const { code } = parsed.data;

    const user = await prisma.user.findUnique({ where: { id: session.userId } });
    if (!user?.twoFactorSecret) {
      throw new AppError("AUTH_2FA_REQUIRED");
    }

    const valid = verifyTotpCode(user.twoFactorSecret, code);
    if (!valid) {
      await logAuditEvent({
        userId: user.id,
        action: "auth.2fa_failed",
        resourceType: "user",
        resourceId: user.id,
        ipAddress: ip,
        userAgent: req.headers.get("user-agent"),
      });
      throw new AppError("AUTH_2FA_INVALID");
    }

    // First successful verification enables 2FA permanently on this account.
    if (!user.twoFactorEnabled) {
      await prisma.user.update({
        where: { id: user.id },
        data: { twoFactorEnabled: true },
      });
    }

    // Re-issue a fully trusted session now that 2FA is verified.
    const sellerId = await getSellerIdForUser(user.id, user.role);
    const newToken = await createSession({
      userId: user.id,
      email: user.email,
      role: user.role,
      twoFactorVerified: true,
      sellerId,
    });
    await setSessionCookie(newToken, user.role);

    await logAuditEvent({
      userId: user.id,
      action: "auth.2fa_verified",
      resourceType: "user",
      resourceId: user.id,
      ipAddress: ip,
      userAgent: req.headers.get("user-agent"),
    });

    return Response.json({ message: "Two-factor authentication verified." });
  } catch (error) {
    return errorResponse(error);
  }
}
