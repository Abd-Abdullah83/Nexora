// app/api/sellers/orders/route.ts
//
// Phase 6 — GET list of the active seller's own order lines.
// Follows the same inline getActiveSeller() auth pattern Phase 4/5's
// store/listings routes used (flagged as a style nit, not a security gap,
// in the Phase 4/5 README §6 — kept consistent here rather than mixing
// patterns mid-feature).

import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getSellerOrderLines, getSellerOrderCounts } from "@/lib/sellers/seller-orders.service";
import { orderListQuerySchema } from "@/lib/validation/seller-order";
import { AppError, errorResponse } from "@/lib/errors";

async function getActiveSeller(userId: string) {
  const seller = await prisma.seller.findUnique({ where: { userId } });
  if (!seller || seller.status !== "active") return null;
  return seller;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) throw new AppError("AUTH_REQUIRED");

    const seller = await getActiveSeller(session.userId);
    if (!seller) throw new AppError("AUTH_REQUIRED", { seller: "No active seller account." });

    const params = Object.fromEntries(req.nextUrl.searchParams);
    const parsed = orderListQuerySchema.safeParse(params);
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", parsed.error.flatten());

    const [list, counts] = await Promise.all([
      getSellerOrderLines(seller.id, parsed.data),
      getSellerOrderCounts(seller.id),
    ]);

    return Response.json({ ...list, counts });
  } catch (error) {
    return errorResponse(error);
  }
}
