import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getSubscriptionForSeller, checkAndUpdateTrialExpiry } from "@/lib/sellers/billing.service";
import { AppError, errorResponse } from "@/lib/errors";

export async function GET(_req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) throw new AppError("AUTH_REQUIRED");

    const seller = await prisma.seller.findUnique({
      where: { userId: session.userId },
      select: { id: true, status: true, sellerType: true },
    });
    if (!seller) throw new AppError("VALIDATION_ERROR", { seller: "Seller account not found." });
    if (seller.status !== "active") throw new AppError("ADMIN_UNAUTHORISED");

    // Opportunistic trial check
    await checkAndUpdateTrialExpiry(seller.id).catch(() => {});

    const subscription = await getSubscriptionForSeller(seller.id);
    return Response.json({ subscription, sellerType: seller.sellerType });
  } catch (error) {
    return errorResponse(error);
  }
}
