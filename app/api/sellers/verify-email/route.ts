import { NextRequest } from "next/server";
import { verifySellerEmail } from "@/lib/sellers/seller.service";
import { getClientIp } from "@/lib/security/rate-limit";
import { AppError, errorResponse } from "@/lib/errors";

// NOTE: the scaling doc's API contract lists this as POST, but the
// existing buyer email-verification endpoint it's explicitly meant to
// mirror (GET /api/auth/verify-email?token=) is a GET. Matching that
// established pattern exactly — same query-param shape, same
// "already verified" friendly response on repeat visits — rather than
// the literal verb, since the doc's own framing is "reuse the existing
// pattern." Documented here in case this needs reconciling later.
export async function GET(req: NextRequest) {
  const ip = getClientIp(req.headers);

  try {
    const token = req.nextUrl.searchParams.get("token");
    if (!token) {
      throw new AppError("VALIDATION_ERROR", { token: "Token is required." });
    }

    const result = await verifySellerEmail(token, ip);

    if (result.alreadyVerified) {
      return Response.json({
        sellerId: result.sellerId,
        alreadyVerified: true,
        message: "Your business email is already verified. Continue to phone verification.",
      });
    }

    return Response.json({
      sellerId: result.sellerId,
      message: "Business email verified. Next, verify your phone number to continue.",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
