import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/rbac";
import { resendSellerVerificationEmail } from "@/lib/sellers/seller.service";
import { getClientIp } from "@/lib/security/rate-limit";
import { AppError, errorResponse } from "@/lib/errors";

/**
 * POST /api/sellers/resend-email
 *
 * Session-scoped (no token in the request) — always resends to the
 * CALLER's own seller application, never to one specified by the
 * client. This is the same scoping principle every other seller.service
 * function follows (see seller.service.ts header comment).
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);

  try {
    const session = await requireAuth();
    if (!session) throw new AppError("AUTH_REQUIRED");

    await resendSellerVerificationEmail({ userId: session.userId, ipAddress: ip });

    return Response.json({
      message: "A new verification email has been sent.",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
