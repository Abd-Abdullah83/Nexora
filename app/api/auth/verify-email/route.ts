import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { isExpired } from "@/lib/security/tokens";
import { logAuditEvent } from "@/lib/audit";
import { AppError, errorResponse } from "@/lib/errors";
import { getClientIp } from "@/lib/security/rate-limit";

export async function GET(req: NextRequest) {
  const ip = getClientIp(req.headers);

  try {
    const token = req.nextUrl.searchParams.get("token");
    if (!token) {
      throw new AppError("VALIDATION_ERROR", { token: "Token is required." });
    }

    const user = await prisma.user.findFirst({
      where: { emailVerifyToken: token },
    });

    if (!user) {
      // No account has ever had this exact token, so it's genuinely invalid.
      throw new AppError("AUTH_TOKEN_EXPIRED");
    }

    // Check verification status before checking expiry. A token that was
    // already used successfully is a settled, known state — not an error —
    // so it gets its own clear message instead of being lumped in with
    // "invalid or expired."
    if (user.emailVerified) {
      return Response.json({
        alreadyVerified: true,
        message: "Your email is already verified. You can log in now.",
      });
    }

    if (isExpired(user.emailVerifyExpires)) {
      throw new AppError("AUTH_TOKEN_EXPIRED");
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerifyExpires: null,
        // Token is intentionally kept (not nulled) so a repeat visit to this
        // same link can still be recognized as "already verified" above,
        // rather than falling through to a generic invalid-token error.
      },
    });

    await logAuditEvent({
      userId: user.id,
      action: "auth.email_verified",
      resourceType: "user",
      resourceId: user.id,
      ipAddress: ip,
      userAgent: req.headers.get("user-agent"),
    });

    return Response.json({ message: "Email verified successfully. You can now log in." });
  } catch (error) {
    return errorResponse(error);
  }
}
