import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { rateLimit, getClientIp } from "@/lib/security/rate-limit";
import { requestPhoneOtp } from "@/lib/sellers/seller.service";
import { sellerRequestOtpSchema } from "@/lib/validation/seller";
import { AppError, errorResponse } from "@/lib/errors";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);

  try {
    const session = await requireAuth();
    if (!session) throw new AppError("AUTH_REQUIRED");

    // Per Phase 2 security review: rate-limit OTP requests per IP, in
    // addition to the per-(seller, phone) DB-backed throttle already
    // inside requestPhoneOtp() — two independent layers, since an IP can
    // cycle through phone numbers and a phone number could theoretically
    // be requested from rotating IPs.
    const { allowed } = await rateLimit(`seller:otp:ip:${ip}`, 10, 3600);
    if (!allowed) {
      throw new AppError("RATE_LIMIT_EXCEEDED", {
        message: "Too many OTP requests from this network. Please try again later.",
      });
    }

    const body = await req.json();
    const parsed = sellerRequestOtpSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError("VALIDATION_ERROR", parsed.error.flatten().fieldErrors);
    }

    // sellerId is looked up from the session's OWN seller record — never
    // accepted from the client — so one seller can never trigger an OTP
    // send against another seller's row.
    const seller = await prisma.seller.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!seller) {
      throw new AppError("VALIDATION_ERROR", { seller: "No seller application found for this account." });
    }

    await requestPhoneOtp({
      sellerId: seller.id,
      phone: parsed.data.phone,
      requestIp: ip,
    });

    return Response.json({ message: "OTP sent. It expires in 10 minutes." });
  } catch (error) {
    return errorResponse(error);
  }
}
