import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { AppError, errorResponse } from "@/lib/errors";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) throw new AppError("ADMIN_UNAUTHORISED");

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // ── Summary stats ──────────────────────────────────────────────────────
    const [
      totalOrders,
      totalRevenue,
      totalCustomers,
      totalProducts,
      recentOrders,
      lowStockProducts,
      pendingReviews,
    ] = await Promise.all([
      prisma.order.count(),
      prisma.order.aggregate({
        _sum: { total: true },
        where: { paymentStatus: "paid" },
      }),
      prisma.user.count({ where: { role: "customer" } }),
      prisma.product.count({ where: { status: "active", deletedAt: null } }),
      prisma.order.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      prisma.product.count({
        where: {
          deletedAt: null,
          status: "active",
          stockQty: { lte: 5 },
        },
      }),
      prisma.review.count({ where: { status: "pending" } }),
    ]);

    // ── Revenue by day (last 30 days) ──────────────────────────────────────
    const dailyOrders = await prisma.order.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true, total: true, paymentStatus: true },
      orderBy: { createdAt: "asc" },
    });

    // Group by date
    const revenueByDay: Record<string, { date: string; orders: number; revenue: number }> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      revenueByDay[key] = { date: key, orders: 0, revenue: 0 };
    }
    for (const order of dailyOrders) {
      const key = order.createdAt.toISOString().slice(0, 10);
      if (revenueByDay[key]) {
        revenueByDay[key].orders += 1;
        if (order.paymentStatus === "paid") {
          revenueByDay[key].revenue += Number(order.total);
        }
      }
    }

    // ── Orders by status ───────────────────────────────────────────────────
    const ordersByStatus = await prisma.order.groupBy({
      by: ["status"],
      _count: { status: true },
    });

    // ── Top products by order count ────────────────────────────────────────
    const topProducts = await prisma.orderItem.groupBy({
      by: ["productName"],
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 5,
    });

    // ── Recent orders ──────────────────────────────────────────────────────
    const latestOrders = await prisma.order.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { fullName: true } } },
    });

    return Response.json({
      summary: {
        totalOrders,
        totalRevenue: Number(totalRevenue._sum.total ?? 0),
        totalCustomers,
        totalProducts,
        recentOrders,
        lowStockProducts,
        pendingReviews,
      },
      revenueChart: Object.values(revenueByDay),
      ordersByStatus: ordersByStatus.map((s) => ({
        status: s.status,
        count: s._count.status,
      })),
      topProducts: topProducts.map((p) => ({
        name: p.productName,
        quantity: p._sum.quantity ?? 0,
      })),
      latestOrders: latestOrders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        customerName: o.user.fullName,
        total: Number(o.total),
        status: o.status,
        paymentStatus: o.paymentStatus,
        createdAt: o.createdAt,
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
