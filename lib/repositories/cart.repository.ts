import { prisma } from "@/lib/db/prisma";

export async function getCartForUser(userId: string) {
  return prisma.cartItem.findMany({
    where: { userId },
    include: {
      product: {
        include: { images: { where: { isPrimary: true }, take: 1 } },
      },
    },
    orderBy: { addedAt: "desc" },
  });
}

export async function addOrUpdateCartItem(
  userId: string,
  productId: string,
  quantity: number
) {
  const existing = await prisma.cartItem.findFirst({
    where: {
      userId,
      productId,
      variantId: null,
    },
  });

  if (existing) {
    return prisma.cartItem.update({
      where: { id: existing.id },
      data: { quantity },
    });
  }

  return prisma.cartItem.create({
    data: {
      userId,
      productId,
      quantity,
      variantId: null,
    },
  });
}

export async function removeCartItem(userId: string, productId: string) {
  return prisma.cartItem.deleteMany({
    where: {
      userId,
      productId,
      variantId: null,
    },
  });
}
export async function clearCart(userId: string) {
  return prisma.cartItem.deleteMany({ where: { userId } });
}
