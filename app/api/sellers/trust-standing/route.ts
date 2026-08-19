import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getSellerTrustStanding } from "@/lib/sellers/listing-approval.service";
import { AppError, errorResponse } from "@/lib/errors";

// GET /api/sellers/trust-standing
// Lets a seller's own dashboard show "3 of 5 listings approved" progress
// and explain why their latest listing is sitting in pending_review.
export async function GET() {
  try {
    const session = await getSession();
    if (!session) throw new AppError("AUTH_REQUIRED");

    const seller = await prisma.seller.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!seller) throw new AppError("VALIDATION_ERROR", { seller: "No seller account found." });

    const standing = await getSellerTrustStanding(seller.id);
    return Response.json({ standing });
  } catch (error) {
    return errorResponse(error);
  }
}
