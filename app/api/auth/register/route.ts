import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { hashPassword, validatePasswordPolicy } from "@/lib/security/password";
import { generateSecureToken, hoursFromNow } from "@/lib/security/tokens";
import { rateLimit, getClientIp } from "@/lib/security/rate-limit";
import { registerSchema } from "@/lib/validation/auth";
import { sendVerificationEmail } from "@/lib/email/send";
import { logAuditEvent } from "@/lib/audit";
import { AppError, errorResponse } from "@/lib/errors";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);

  try {
    const { allowed, retryAfterSeconds } = await rateLimit(`register:${ip}`, 10, 60);
    if (!allowed) {
      throw new AppError("RATE_LIMIT_EXCEEDED", { retryAfterSeconds });
    }

    const body = await req.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError("VALIDATION_ERROR", parsed.error.flatten());
    }
    const { fullName, username, email, password } = parsed.data;

    const policyError = validatePasswordPolicy(password);
    if (policyError) {
      throw new AppError("VALIDATION_ERROR", { password: policyError });
    }

    // Check email and username uniqueness separately for clear error messages
    const existingEmail = await prisma.user.findUnique({ where: { email } });
    if (existingEmail) {
      throw new AppError("AUTH_EMAIL_EXISTS");
    }

    const existingUsername = await prisma.user.findUnique({ where: { username } });
    if (existingUsername) {
      throw new AppError("AUTH_USERNAME_EXISTS");
    }

    const passwordHash = await hashPassword(password);
    const verifyToken = generateSecureToken();

    const user = await prisma.user.create({
      data: {
        email,
        username,
        password: passwordHash,
        fullName,
        emailVerifyToken: verifyToken,
        emailVerifyExpires: hoursFromNow(24),
      },
    });

    await sendVerificationEmail(email, verifyToken, fullName);

    if (process.env.NODE_ENV !== "production") {
      const devLink = `${process.env.APP_URL || "http://localhost:3000"}/verify-email?token=${verifyToken}`;
      console.log("\n[DEV ONLY] Verification link for", email, ":\n", devLink, "\n");
    }

    await logAuditEvent({
      userId: user.id,
      action: "auth.register",
      resourceType: "user",
      resourceId: user.id,
      ipAddress: ip,
      userAgent: req.headers.get("user-agent"),
    });

    return Response.json(
      {
        message: "Registration successful. Please check your email to verify your account.",
      },
      { status: 201 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
