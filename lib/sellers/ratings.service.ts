// lib/sellers/ratings.service.ts
// Phase 10 gap fill: recomputeSellerRatingsAggregate() for the new
// seller_ratings_aggregates table. Also exports getSellerRatingsAggregate()
// for the dashboard and public store page.
//
// WIRING NEEDED (see NOTIFICATION-WIRING.md pattern):
// Call recomputeSellerRatingsAggregate(sellerId) from:
//   1. app/api/admin/reviews/route.ts PATCH handler — after status → approved
//   2. app/api/admin/disputes/[id]/resolve/route.ts — after any resolution
//   3. app/api/sellers/orders/[id]/fulfillment — after delivered

import { prisma } from "@/lib/db/prisma";

export async function recomputeSellerRatingsAggregate(sellerId: string): Promise<void> {
  // avgRating + totalReviews: approved reviews on this seller's products
  const reviewAgg = await prisma.review.aggregate({
    where: { product: { sellerId }, status: "approved" },
    _avg: { rating: true },
    _count: { id: true },
  });
  const avgRating = Number((reviewAgg._avg.rating ?? 0).toFixed(2));
  const totalReviews = reviewAgg._count.id;

  // onTimeDeliveryRate: delivered / (delivered + shipped)
  const [delivered, fulfilled] = await Promise.all([
    prisma.orderItem.count({ where: { sellerId, fulfillmentStatus: "delivered" } }),
    prisma.orderItem.count({ where: { sellerId, fulfillmentStatus: { in: ["delivered", "shipped"] } } }),
  ]);
  const onTimeDeliveryRate = fulfilled > 0
    ? Number(((delivered / fulfilled) * 100).toFixed(2))
    : 0;

  // disputeRate: order items with any dispute / total order items
  const [disputed, totalItems] = await Promise.all([
    prisma.dispute.count({ where: { orderItem: { sellerId } } }),
    prisma.orderItem.count({ where: { sellerId } }),
  ]);
  const disputeRate = totalItems > 0
    ? Number(((disputed / totalItems) * 100).toFixed(2))
    : 0;

  await prisma.sellerRatingsAggregate.upsert({
    where: { sellerId },
    create: { sellerId, avgRating, totalReviews, onTimeDeliveryRate, disputeRate },
    update: { avgRating, totalReviews, onTimeDeliveryRate, disputeRate },
  });
}

export async function getSellerRatingsAggregate(sellerId: string) {
  const agg = await prisma.sellerRatingsAggregate.findUnique({ where: { sellerId } });
  if (!agg) return { avgRating: 0, totalReviews: 0, onTimeDeliveryRate: 0, disputeRate: 0 };
  return {
    avgRating: Number(agg.avgRating),
    totalReviews: agg.totalReviews,
    onTimeDeliveryRate: Number(agg.onTimeDeliveryRate),
    disputeRate: Number(agg.disputeRate),
  };
}

export { recomputeSellerRatingsAggregate as recomputeStoreRating };