// lib/sellers/analytics.service.ts
//
// Phase 10 — Seller analytics service.
// All queries are scoped to a specific sellerId — the API routes enforce
// this, but every function here also takes sellerId explicitly and filters
// by it, so this service can NEVER be called in a way that leaks one
// seller's data to another.

import { prisma } from "@/lib/db/prisma";

export interface SellerAnalyticsParams {
  sellerId: string;
  fromDate: Date;
  toDate: Date;
}

export async function getSellerRevenueAndOrders(params: SellerAnalyticsParams) {
  const { sellerId, fromDate, toDate } = params;

  // All paid order items for this seller in the date range
  const items = await prisma.orderItem.findMany({
    where: {
      sellerId,
      order: {
        paymentStatus: "paid",
        createdAt: { gte: fromDate, lte: toDate },
      },
    },
    include: {
      order: { select: { createdAt: true } },
    },
  });

  // Group by date for the chart
  const byDate: Record<string, { revenue: number; orders: Set<string> }> = {};
  let totalRevenue = 0;
  const orderIds = new Set<string>();

  for (const item of items) {
    const dateKey = item.order.createdAt.toISOString().slice(0, 10);
    if (!byDate[dateKey]) byDate[dateKey] = { revenue: 0, orders: new Set() };
    byDate[dateKey].revenue += Number(item.totalPrice);
    byDate[dateKey].orders.add(item.orderId);
    totalRevenue += Number(item.totalPrice);
    orderIds.add(item.orderId);
  }

  // revenueByDate — matches the page's expected field name
  const revenueByDate = Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, revenue: v.revenue, orders: v.orders.size }));

  const totalOrders = orderIds.size;
  const totalUnitsSold = items.reduce((sum, i) => sum + i.quantity, 0);
  // avgOrderValue — total revenue divided by unique orders (0 if no orders)
  const avgOrderValue = totalOrders > 0
    ? Number((totalRevenue / totalOrders).toFixed(2))
    : 0;

  return {
    totalRevenue: Number(totalRevenue.toFixed(2)),
    totalOrders,
    totalUnitsSold,   // was totalUnits — renamed to match page
    avgOrderValue,    // new — computed from totalRevenue / totalOrders
    // walletBalance and pendingEscrow are fetched separately in
    // getFullSellerAnalytics() and merged here
  };
}

export async function getTopProducts(params: SellerAnalyticsParams & { limit?: number }) {
  const { sellerId, fromDate, toDate, limit = 5 } = params;

  const items = await prisma.orderItem.groupBy({
    by: ["productId", "productName"],
    where: {
      sellerId,
      order: {
        paymentStatus: "paid",
        createdAt: { gte: fromDate, lte: toDate },
      },
    },
    _sum: { totalPrice: true, quantity: true },
    _count: { orderId: true },
    orderBy: { _sum: { totalPrice: "desc" } },
    take: limit,
  });

  return items.map((item) => ({
    productId: item.productId,
    productName: item.productName,
    revenue: Number(item._sum.totalPrice ?? 0),
    unitsSold: item._sum.quantity ?? 0,
    orders: item._count.orderId,
  }));
}

export async function getViewsVsSales(params: SellerAnalyticsParams) {
  // Note: "views" requires a product_views event-tracking table that
  // doesn't exist in this codebase yet (not added in any prior phase).
  // Returning the sales data shape with views=null rather than silently
  // returning zeros (which would look real and mislead). When a views
  // tracking table is added, replace null with actual view counts.
  const { sellerId, fromDate, toDate } = params;

  const products = await prisma.product.findMany({
    where: { sellerId, deletedAt: null },
    select: {
      id: true,
      name: true,
      slug: true,
      orderItems: {
        where: {
          order: {
            paymentStatus: "paid",
            createdAt: { gte: fromDate, lte: toDate },
          },
        },
        select: { quantity: true },
      },
    },
  });

  return products.map((p) => ({
    productId: p.id,
    productName: p.name,
    slug: p.slug,
    unitsSold: p.orderItems.reduce((s, i) => s + i.quantity, 0),
    views: null, // not tracked yet — see comment above
  }));
}

export async function getSellerWalletSummary(sellerId: string) {
  const wallet = await prisma.wallet.findUnique({
    where: { sellerId },
    select: { availableBalance: true, pendingBalance: true },
  });
  return {
    walletBalance: wallet ? Number(wallet.availableBalance) : 0,
    pendingEscrow: wallet ? Number(wallet.pendingBalance) : 0,
  };
}

export async function getFulfillmentBreakdown(params: SellerAnalyticsParams) {
  const { sellerId, fromDate, toDate } = params;

  const groups = await prisma.orderItem.groupBy({
    by: ["fulfillmentStatus"],
    where: {
      sellerId,
      order: {
        paymentStatus: "paid",
        createdAt: { gte: fromDate, lte: toDate },
      },
    },
    _count: { id: true },
  });

  return groups.map((g) => ({
    status: g.fulfillmentStatus,
    count: g._count.id,
  }));
}

export async function getFullSellerAnalytics(params: SellerAnalyticsParams) {
  const [revenueAndOrders, walletSummary, topProducts, fulfillmentBreakdown, viewsVsSales] =
    await Promise.all([
      getSellerRevenueAndOrders(params),
      getSellerWalletSummary(params.sellerId),
      getTopProducts(params),
      getFulfillmentBreakdown(params),
      getViewsVsSales(params),
    ]);

  return {
    summary: { ...revenueAndOrders, ...walletSummary },
    topProducts,
    fulfillmentBreakdown,
    viewsVsSales,
  };
}