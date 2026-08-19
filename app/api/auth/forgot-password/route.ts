import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { generateSecureToken, hoursFromNow } from "@/lib/security/tokens";
import { rateLimit, getClientIp } from "@/lib/security/rate-limit";
import { forgotPasswordSchema } from "@/lib/validation/auth";
import { sendPasswordResetEmail } from "@/lib/email/send";
import { logAuditEvent } from "@/lib/audit";
import { AppError, errorResponse } from "@/lib/errors";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);

  try {
    const { allowed, retryAfterSeconds } = await rateLimit(
      `forgot-password:${ip}`,
      5,
      60
    );
    if (!allowed) {
      throw new AppError("RATE_LIMIT_EXCEEDED", { retryAfterSeconds });
    }

    const body = await req.json();
    const parsed = forgotPasswordSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError("VALIDATION_ERROR", parsed.error.flatten());
    }
    const { email } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });

    // Always return the same response whether or not the email exists,
    // so the endpoint doesn't reveal which emails are registered.
    if (user) {
      const resetToken = generateSecureToken();

      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetToken: resetToken,
          passwordResetExpires: hoursFromNow(1),
        },
      });

      await sendPasswordResetEmail(email, resetToken, user.fullName);

      if (process.env.NODE_ENV !== "production") {
        const devLink = `${process.env.APP_URL || "http://localhost:3000"}/reset-password?token=${resetToken}`;
        console.log("\n[DEV ONLY] Password reset link for", email, ":\n", devLink, "\n");
      }

      await logAuditEvent({
        userId: user.id,
        action: "auth.password_reset_requested",
        resourceType: "user",
        resourceId: user.id,
        ipAddress: ip,
        userAgent: req.headers.get("user-agent"),
      });
    }

    return Response.json({
      message: "If an account exists with that email, a reset link has been sent.",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
