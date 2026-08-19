import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { createEscrowHoldsForOrder } from "@/lib/wallet/escrow.service";

// ─────────────────────────────────────────────────────────────────────────
// Order number generation
// ─────────────────────────────────────────────────────────────────────────

/**
 * Generates a human-readable, sortable order number.
 * Format: ORD-YYYYMMDD-XXXXXX (XXXXXX = random alphanumeric for uniqueness).
 * Not guaranteed globally unique by construction alone, but collision odds
 * are negligible; the DB's @unique constraint on orderNumber is the real
 * backstop.
 */
export function generateOrderNumber(): string {
  const now = new Date();
  const datePart = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");

  const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();

  return `ORD-${datePart}-${randomPart}`;
}

// ─────────────────────────────────────────────────────────────────────────
// Order reads
// ─────────────────────────────────────────────────────────────────────────

/**
 * Fetches a single order with its line items, for the order confirmation
 * page and any other single-order detail view. Caller is responsible for
 * checking order.userId matches the requesting session (ownership check
 * lives at the page/route level, not here, since admin views need to read
 * any order regardless of owner).
 */
export async function getOrderById(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          seller: {
            select: { id: true, displayName: true },
          },
        },
      },
    },
  });
}
/**
 * Fetches all orders belonging to a user, most recent first — used by the
 * "My Orders" list page.
 */
export async function getOrdersByUser(userId: string) {
  return prisma.order.findMany({
    where: { userId },
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Payment confirmation — added in the Phase 6 payment-confirmation pass
// ─────────────────────────────────────────────────────────────────────────

/**
 * Decrements stock for every line item of an order, inside the caller's
 * own transaction. Used at ORDER CREATION time now (see
 * app/api/checkout/orders/route.ts) — moved here from confirmOrderPayment
 * so stock actually reflects reality the moment an order is placed,
 * instead of staying untouched until an admin manually confirms payment.
 *
 * Throws CART_ITEM_EXCEEDS_STOCK if any item no longer has enough stock —
 * the caller's transaction rolls back automatically, so an order is never
 * left half-created if stock ran out between cart and checkout.
 */
export async function decrementStockForItems(
  tx: Prisma.TransactionClient,
  items: { productId: string; variantId: string | null; productName: string; quantity: number }[]
) {
  for (const item of items) {
    if (item.variantId) {
      const variant = await tx.productVariant.findUnique({
        where: { id: item.variantId },
        select: { stockQty: true },
      });
      if (!variant || variant.stockQty < item.quantity) {
        throw new AppError("CART_ITEM_EXCEEDS_STOCK", {
          item: item.productName,
          message: `"${item.productName}" no longer has enough stock to fulfill this order.`,
        });
      }
      await tx.productVariant.update({
        where: { id: item.variantId },
        data: { stockQty: { decrement: item.quantity } },
      });
    } else {
      const product = await tx.product.findUnique({
        where: { id: item.productId },
        select: { stockQty: true },
      });
      if (!product || product.stockQty < item.quantity) {
        throw new AppError("CART_ITEM_EXCEEDS_STOCK", {
          item: item.productName,
          message: `"${item.productName}" no longer has enough stock to fulfill this order.`,
        });
      }
      await tx.product.update({
        where: { id: item.productId },
        data: { stockQty: { decrement: item.quantity } },
      });
    }
  }
}

/**
 * Confirms payment for an order. Stock is NOT touched here anymore — it
 * was already decremented at order creation (decrementStockForItems,
 * called from checkout/orders/route.ts). This function now only flips
 * the order into a paid state.
 *
 * Called by:
 *  - The admin "Mark as Paid" button (for COD orders collected on delivery)
 *  - A future Stripe/JazzCash/etc. webhook handler, once real gateways
 *    are integrated — same function, just a different caller.
 *
 * Idempotent: calling this twice on an already-paid order is a no-op,
 * not an error — this matters because webhooks can and do fire more than
 * once for the same event.
 */
export async function confirmOrderPayment(params: {
  orderId: string;
  providerReference?: string | null;
  confirmedBy: "admin" | "webhook";
  adminUserId?: string;
}) {
  const { orderId, providerReference } = params;

  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) {
      throw new AppError("VALIDATION_ERROR", { orderId: "Order not found." });
    }

    // Idempotency guard — already paid, nothing to do. Return as-is rather
    // than throwing, since webhooks legitimately retry.
    if (order.paymentStatus === "paid") {
      return order;
    }

    const updated = await tx.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: "paid",
        status: order.status === "pending" ? "confirmed" : order.status,
        paidAt: new Date(),
        paymentIntentId: providerReference ?? order.paymentIntentId,
      },
      include: { items: true },
    });

    // Phase 7: capture funds into escrow the moment payment is confirmed.
    // See escrow.service.ts's file header for why this is the correct
    // hook point given no real payment gateway exists yet. Items here
    // need sellerId — Phase 6's order_items.sellerId column makes this
    // available without an extra query.
    await createEscrowHoldsForOrder(
      tx,
      updated.items.map((item) => ({
        id: item.id,
        sellerId: item.sellerId,
        totalPrice: item.totalPrice,
      }))
    );

    return updated;
  });
}

/**
 * Marks an order's payment as failed. Does NOT touch stock — since stock
 * is only decremented on success (confirmOrderPayment), a failed payment
 * has nothing to roll back.
 */
export async function markOrderPaymentFailed(params: {
  orderId: string;
  reason?: string;
}) {
  return prisma.order.update({
    where: { id: params.orderId },
    data: {
      paymentStatus: "failed",
      notes: params.reason ? `payment_failed: ${params.reason}` : undefined,
    },
  });
}

/**
 * Records a refund against a paid order. Stock is intentionally NOT
 * restored automatically — a refunded item is often damaged, returned to
 * a different warehouse, or simply written off. Restocking is a separate
 * deliberate admin action, not an automatic side effect of refunding money.
 */
export async function refundOrder(params: {
  orderId: string;
  amount: number;
  providerRefundReference: string | null;
  reason?: string;
}) {
  const order = await prisma.order.findUnique({ where: { id: params.orderId } });
  if (!order) {
    throw new AppError("VALIDATION_ERROR", { orderId: "Order not found." });
  }
  if (order.paymentStatus !== "paid") {
    throw new AppError("VALIDATION_ERROR", {
      paymentStatus: "Only paid orders can be refunded.",
    });
  }

  return prisma.order.update({
    where: { id: params.orderId },
    data: {
      paymentStatus: "refunded",
      status: "refunded",
      refundReference: params.providerRefundReference,
      refundAmount: params.amount,
      refundedAt: new Date(),
      notes: params.reason ? `refund: ${params.reason}` : order.notes,
    },
  });
}