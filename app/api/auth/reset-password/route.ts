import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { hashPassword, validatePasswordPolicy } from "@/lib/security/password";
import { isExpired } from "@/lib/security/tokens";
import { rateLimit, getClientIp } from "@/lib/security/rate-limit";
import { resetPasswordSchema } from "@/lib/validation/auth";
import { logAuditEvent } from "@/lib/audit";
import { AppError, errorResponse } from "@/lib/errors";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);

  try {
    const { allowed, retryAfterSeconds } = await rateLimit(
      `reset-password:${ip}`,
      5,
      60
    );
    if (!allowed) {
      throw new AppError("RATE_LIMIT_EXCEEDED", { retryAfterSeconds });
    }

    const body = await req.json();
    const parsed = resetPasswordSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError("VALIDATION_ERROR", parsed.error.flatten());
    }
    const { token, password } = parsed.data;

    const policyError = validatePasswordPolicy(password);
    if (policyError) {
      throw new AppError("VALIDATION_ERROR", { password: policyError });
    }

    const user = await prisma.user.findFirst({
      where: { passwordResetToken: token },
    });

    if (!user || isExpired(user.passwordResetExpires)) {
      throw new AppError("AUTH_TOKEN_EXPIRED");
    }

    const newHash = await hashPassword(password);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: newHash,
        passwordResetToken: null,
        passwordResetExpires: null,
        failedLoginCount: 0,
        lockedUntil: null,
      },
    });

    await logAuditEvent({
      userId: user.id,
      action: "auth.password_reset_completed",
      resourceType: "user",
      resourceId: user.id,
      ipAddress: ip,
      userAgent: req.headers.get("user-agent"),
    });

    return Response.json({ message: "Password reset successfully. You can now log in." });
  } catch (error) {
    return errorResponse(error);
  }
}
