// app/api/sellers/analytics/route.ts
import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getFullSellerAnalytics } from "@/lib/sellers/analytics.service";
import { AppError, errorResponse } from "@/lib/errors";

async function getActiveSeller(userId: string) {
  const seller = await prisma.seller.findUnique({ where: { userId }, select: { id: true, status: true } });
  if (!seller || seller.status !== "active") throw new AppError("ADMIN_UNAUTHORISED");
  return seller;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) throw new AppError("AUTH_REQUIRED");
    const seller = await getActiveSeller(session.userId);

    const { searchParams } = req.nextUrl;
    const fromDate = searchParams.get("from")
      ? new Date(searchParams.get("from")!)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const toDate = searchParams.get("to")
      ? new Date(searchParams.get("to")!)
      : new Date();

    const data = await getFullSellerAnalytics({ sellerId: seller.id, fromDate, toDate });
    return Response.json(data);
  } catch (error) {
    return errorResponse(error);
  }
}
