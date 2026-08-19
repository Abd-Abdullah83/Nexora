import { prisma } from "@/lib/db/prisma";

export async function getWishlistForUser(userId: string) {
  return prisma.wishlist.findMany({
    where: { userId },
    include: {
      product: {
        include: { images: { where: { isPrimary: true }, take: 1 } },
      },
    },
    orderBy: { addedAt: "desc" },
  });
}

export async function addToWishlist(userId: string, productId: string) {
  return prisma.wishlist.upsert({
    where: { userId_productId: { userId, productId } },
    update: {},
    create: { userId, productId },
  });
}

export async function removeFromWishlist(userId: string, productId: string) {
  return prisma.wishlist.delete({
    where: { userId_productId: { userId, productId } },
  });
}
