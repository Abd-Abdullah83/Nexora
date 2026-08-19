// app/api/sellers/ratings/route.ts
// GET /api/sellers/ratings — returns this seller's ratings aggregate

import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getSellerRatingsAggregate } from "@/lib/sellers/ratings.service";
import { AppError, errorResponse } from "@/lib/errors";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) throw new AppError("AUTH_REQUIRED");

    const seller = await prisma.seller.findUnique({
      where: { userId: session.userId },
      select: { id: true, status: true },
    });
    if (!seller || seller.status !== "active") throw new AppError("ADMIN_UNAUTHORISED");

    const ratings = await getSellerRatingsAggregate(seller.id);
    return Response.json({ ratings });
  } catch (error) {
    return errorResponse(error);
  }
}
