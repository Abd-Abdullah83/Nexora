// app/api/sellers/customers/route.ts
// GET /api/sellers/customers
//
// Phase 6 gap fill: "seller Customers view — minimal PII (name, city,
// order history with THAT seller only)."
//
// This is a pure read-side aggregation — no new tables, just a carefully
// scoped query over existing OrderItem.sellerId data. Returns one row per
// unique buyer who has ever placed an order containing this seller's items,
// with the order count and spend figures scoped to this seller only.
// The buyer's city is derived from the shipping address JSON on their most
// recent order with this seller.

import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { AppError, errorResponse } from "@/lib/errors";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) throw new AppError("AUTH_REQUIRED");

    const seller = await prisma.seller.findUnique({
      where: { userId: session.userId },
      select: { id: true, status: true },
    });
    if (!seller || seller.status !== "active") throw new AppError("ADMIN_UNAUTHORISED");

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") ?? "25")));
    const search = searchParams.get("search")?.trim() ?? "";

    // Distinct buyer userIds from this seller's order items
    const buyerIds = await prisma.orderItem.findMany({
      where: { sellerId: seller.id },
      distinct: ["orderId"],
      select: { order: { select: { userId: true } } },
    }).then((items) => [...new Set(items.map((i) => i.order.userId))]);

    const filteredIds = search
      ? (
          await prisma.user.findMany({
            where: {
              id: { in: buyerIds },
              OR: [
                { fullName: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
              ],
            },
            select: { id: true },
          })
        ).map((u) => u.id)
      : buyerIds;

    const total = filteredIds.length;
    const paginatedIds = filteredIds.slice((page - 1) * pageSize, page * pageSize);

    if (paginatedIds.length === 0) {
      return Response.json({ customers: [], total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
    }

    // Aggregate order count + spend scoped to THIS seller's items only
    const aggregates = await prisma.orderItem.groupBy({
      by: ["orderId"],
      where: { sellerId: seller.id, order: { userId: { in: paginatedIds } } },
      _sum: { totalPrice: true },
      _count: { orderId: true },
    });

    // Map orderId → userId
    const orderUserMap = await prisma.order.findMany({
      where: { id: { in: aggregates.map((a) => a.orderId) } },
      select: { id: true, userId: true, shippingAddress: true, createdAt: true },
    });

    // Aggregate by userId
    const byBuyer: Record<string, { spend: number; orderCount: number; lastOrderAt: Date; city: string }> = {};
    for (const order of orderUserMap) {
      const agg = aggregates.find((a) => a.orderId === order.id);
      if (!agg) continue;
      const existing = byBuyer[order.userId];
      const spend = existing ? existing.spend + Number(agg._sum.totalPrice ?? 0) : Number(agg._sum.totalPrice ?? 0);
      const isNewer = !existing || order.createdAt > existing.lastOrderAt;
      byBuyer[order.userId] = {
        spend,
        orderCount: (existing?.orderCount ?? 0) + 1,
        lastOrderAt: isNewer ? order.createdAt : existing!.lastOrderAt,
        city: isNewer ? ((order.shippingAddress as any)?.city ?? "") : existing!.city,
      };
    }

    const users = await prisma.user.findMany({
      where: { id: { in: paginatedIds } },
      select: { id: true, fullName: true },
    });

    const customers = users.map((user) => {
      const stats = byBuyer[user.id] ?? { spend: 0, orderCount: 0, lastOrderAt: null, city: "" };
      return {
        userId: user.id,
        fullName: user.fullName,
        // Only city — no email, phone, or full address: minimal PII per spec
        city: stats.city,
        totalOrders: stats.orderCount,
        totalSpend: Number(stats.spend.toFixed(2)),
        lastOrderAt: stats.lastOrderAt,
      };
    });

    return Response.json({
      customers,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
