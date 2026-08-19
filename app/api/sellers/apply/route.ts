import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/rbac";
import { rateLimit, getClientIp } from "@/lib/security/rate-limit";
import { applySeller } from "@/lib/sellers/seller.service";
import { sellerApplySchema } from "@/lib/validation/seller";
import { AppError, errorResponse } from "@/lib/errors";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);

  try {
    // Per Phase 2 security review: must require an authenticated buyer
    // session — never an anonymous request. userId always comes from the
    // verified session, never from the request body.
    const session = await requireAuth();
    if (!session) {
      throw new AppError("AUTH_REQUIRED");
    }

    // Rate limit applications per account — prevents application spam
    // even from a single authenticated, otherwise-valid account.
    const { allowed } = await rateLimit(`seller:apply:${session.userId}`, 3, 3600);
    if (!allowed) {
      throw new AppError("RATE_LIMIT_EXCEEDED", {
        message: "Too many seller applications submitted. Please wait before trying again.",
      });
    }

    const body = await req.json();
    const parsed = sellerApplySchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError("VALIDATION_ERROR", parsed.error.flatten().fieldErrors);
    }

    const { sellerType, displayName, businessEmail, businessPhone } = parsed.data;

    const result = await applySeller({
      userId: session.userId,
      sellerType,
      displayName,
      businessEmail,
      businessPhone,
      registrationIp: ip,
      registrationUserAgent: req.headers.get("user-agent"),
    });

    return Response.json(
      {
        seller: { id: result.seller.id },
        message: "Application received. Check your business email to verify and continue.",
      },
      { status: 201 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
