import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { getClientIp } from "@/lib/security/rate-limit";
import { verifyPhoneOtp } from "@/lib/sellers/seller.service";
import { sellerVerifyOtpSchema } from "@/lib/validation/seller";
import { AppError, errorResponse } from "@/lib/errors";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);

  try {
    const session = await requireAuth();
    if (!session) throw new AppError("AUTH_REQUIRED");

    const body = await req.json();
    const parsed = sellerVerifyOtpSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError("VALIDATION_ERROR", parsed.error.flatten().fieldErrors);
    }

    // Same rule as request-otp: sellerId comes from the session's own
    // seller record, never the request body.
    const seller = await prisma.seller.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!seller) {
      throw new AppError("VALIDATION_ERROR", { seller: "No seller application found for this account." });
    }

    await verifyPhoneOtp({
      sellerId: seller.id,
      phone: parsed.data.phone,
      code: parsed.data.code,
      ipAddress: ip,
    });

    return Response.json({
      message: "Phone verified. Your application now moves to identity verification.",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
