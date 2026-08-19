import { prisma } from "@/lib/db/prisma";

export async function getApprovedReviewsForProduct(productId: string) {
  return prisma.review.findMany({
    where: { productId, status: "approved" },
    include: { user: { select: { fullName: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getPendingReviews() {
  return prisma.review.findMany({
    where: { status: "pending" },
    include: {
      user: { select: { fullName: true, email: true } },
      product: { select: { name: true, slug: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function createReview(data: {
  productId: string;
  userId: string;
  rating: number;
  title?: string;
  comment: string;
}) {
  return prisma.review.create({ data });
}

export async function moderateReview(
  id: string,
  status: "approved" | "rejected",
  moderatedBy: string
) {
  return prisma.review.update({
    where: { id },
    data: { status, moderatedBy, moderatedAt: new Date() },
  });
}

export async function getProductRatingSummary(productId: string) {
  const result = await prisma.review.aggregate({
    where: { productId, status: "approved" },
    _avg: { rating: true },
    _count: { rating: true },
  });
  return {
    averageRating: result._avg.rating ?? 0,
    reviewCount: result._count.rating,
  };
}

export async function hasUserPurchasedProduct(userId: string, productId: string) {
  const count = await prisma.orderItem.count({
    where: {
      productId,
      order: {
        userId,
        status: { in: ["delivered", "shipped", "confirmed"] },
      },
    },
  });
  return count > 0;
}
