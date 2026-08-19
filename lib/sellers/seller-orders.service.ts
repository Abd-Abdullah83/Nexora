// lib/sellers/seller-orders.service.ts
//
// Phase 6 — Seller-Scoped Order Management.
//
// Core principle, enforced at every query in this file: a seller can only
// ever see and act on their OWN order_items rows. They never see another
// seller's line items on a shared order, never see the buyer's other
// sellers' totals, and a request for an order_item ID that belongs to a
// different seller returns "not found" — identical to a genuinely
// nonexistent ID, exactly like Phase 5's listings.service.ts pattern that
// the Phase 4/5 README confirmed it followed.
//
// A single buyer Order row can now contain order_items from N different
// sellers. This service operates exclusively at the order_item level for
// any seller-scoped read/write. The parent Order is only ever read for
// shared, non-sensitive context (shipping address, order number, buyer
// name) — never for another seller's totals or line items.

import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors";
import type { OrderItemFulfillmentStatus } from "@prisma/client";
import { markEscrowDelivered, refundEscrowHold } from "@/lib/wallet/escrow.service";
import { createNotification } from "@/lib/notifications/notifications.service";

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

export interface SellerOrderLineItem {
  id: string;
  orderId: string;
  orderNumber: string;
  productId: string;
  productName: string;
  productSku: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  fulfillmentStatus: OrderItemFulfillmentStatus;
  sellerTrackingNumber: string | null;
  sellerTrackingUrl: string | null;
  shippedAt: Date | null;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
  cancellationReason: string | null;
  // Shared, non-sensitive order context — safe to expose
  buyerName: string;
  shippingAddress: unknown;
  orderPlacedAt: Date;
  orderPaymentStatus: string;
}

export interface SellerOrderListFilters {
  status?: OrderItemFulfillmentStatus;
  page?: number;
  pageSize?: number;
}

// ─────────────────────────────────────────────────────────────────────────
// Internal: shape one order_item row (with its order + product) into the
// seller-facing line item. Single source of truth so list and detail
// endpoints can never drift apart on what fields are exposed.
// ─────────────────────────────────────────────────────────────────────────

function toSellerLineItem(row: {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  productSku: string;
  quantity: number;
  unitPrice: any;
  totalPrice: any;
  fulfillmentStatus: OrderItemFulfillmentStatus;
  sellerTrackingNumber: string | null;
  sellerTrackingUrl: string | null;
  shippedAt: Date | null;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
  cancellationReason: string | null;
  order: {
    orderNumber: string;
    shippingAddress: unknown;
    createdAt: Date;
    paymentStatus: string;
    user: { fullName: string };
  };
}): SellerOrderLineItem {
  return {
    id: row.id,
    orderId: row.orderId,
    orderNumber: row.order.orderNumber,
    productId: row.productId,
    productName: row.productName,
    productSku: row.productSku,
    quantity: row.quantity,
    unitPrice: Number(row.unitPrice),
    totalPrice: Number(row.totalPrice),
    fulfillmentStatus: row.fulfillmentStatus,
    sellerTrackingNumber: row.sellerTrackingNumber,
    sellerTrackingUrl: row.sellerTrackingUrl,
    shippedAt: row.shippedAt,
    deliveredAt: row.deliveredAt,
    cancelledAt: row.cancelledAt,
    cancellationReason: row.cancellationReason,
    buyerName: row.order.user.fullName,
    shippingAddress: row.order.shippingAddress,
    orderPlacedAt: row.order.createdAt,
    orderPaymentStatus: row.order.paymentStatus,
  };
}

const ORDER_ITEM_INCLUDE = {
  order: {
    select: {
      orderNumber: true,
      shippingAddress: true,
      createdAt: true,
      paymentStatus: true,
	userId: true,
      user: { select: { fullName: true } },
    },
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────
// Read operations — every query filters by sellerId at the database level
// ─────────────────────────────────────────────────────────────────────────

export async function getSellerOrderLines(
  sellerId: string,
  filters: SellerOrderListFilters = {}
) {
  const { status, page = 1, pageSize = 20 } = filters;

  const where = {
    sellerId,
    ...(status ? { fulfillmentStatus: status } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.orderItem.findMany({
      where,
      include: ORDER_ITEM_INCLUDE,
      orderBy: { order: { createdAt: "desc" } },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.orderItem.count({ where }),
  ]);

  return {
    items: rows.map(toSellerLineItem),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

/**
 * Fetch a single order_item, scoped to this seller.
 * Returns null (not a 403) if the line exists but belongs to a different
 * seller — indistinguishable from a genuinely nonexistent ID, matching the
 * Phase 5 listings.service.ts ownership pattern.
 */
export async function getSellerOrderLineById(sellerId: string, orderItemId: string) {
  const row = await prisma.orderItem.findFirst({
    where: { id: orderItemId, sellerId },
    include: ORDER_ITEM_INCLUDE,
  });
  if (!row) return null;
  return toSellerLineItem(row);
}

/**
 * Summary counts for the seller's order dashboard widget — one query,
 * grouped by fulfillmentStatus, scoped to this seller only.
 */
export async function getSellerOrderCounts(sellerId: string) {
  const grouped = await prisma.orderItem.groupBy({
    by: ["fulfillmentStatus"],
    where: { sellerId },
    _count: { fulfillmentStatus: true },
  });

  const counts: Record<OrderItemFulfillmentStatus, number> = {
    pending: 0,
    confirmed: 0,
    shipped: 0,
    delivered: 0,
    cancelled: 0,
  };
  for (const g of grouped) {
    counts[g.fulfillmentStatus] = g._count.fulfillmentStatus;
  }
  return counts;
}

// ─────────────────────────────────────────────────────────────────────────
// Write operations — all scoped by sellerId in the WHERE clause, so an
// update targeting another seller's line affects zero rows (Prisma throws
// P2025 "record not found", which the caller maps to a 404, never a 403
// that would leak the line's existence).
// ─────────────────────────────────────────────────────────────────────────

// Legal forward transitions per the OrderItemFulfillmentStatus state
// machine. Defined explicitly so a seller can never skip steps (e.g.
// pending → delivered) or move a line backward.
const ALLOWED_TRANSITIONS: Record<OrderItemFulfillmentStatus, OrderItemFulfillmentStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [], // terminal
  cancelled: [], // terminal
};

export async function updateFulfillmentStatus(
  sellerId: string,
  orderItemId: string,
  nextStatus: OrderItemFulfillmentStatus,
  extra: { trackingNumber?: string; trackingUrl?: string; cancellationReason?: string } = {}
) {
  const existing = await prisma.orderItem.findFirst({
    where: { id: orderItemId, sellerId },
    select: { fulfillmentStatus: true },
  });

  if (!existing) {
    throw new AppError("VALIDATION_ERROR", { orderItemId: "Order line not found." });
  }

  const allowed = ALLOWED_TRANSITIONS[existing.fulfillmentStatus];
  if (!allowed.includes(nextStatus)) {
    throw new AppError("VALIDATION_ERROR", {
      status: `Cannot move from "${existing.fulfillmentStatus}" to "${nextStatus}".`,
    });
  }

  if (nextStatus === "shipped" && !extra.trackingNumber) {
    throw new AppError("VALIDATION_ERROR", {
      trackingNumber: "Tracking number is required to mark a line as shipped.",
    });
  }

  if (nextStatus === "cancelled" && !extra.cancellationReason) {
    throw new AppError("VALIDATION_ERROR", {
      cancellationReason: "A cancellation reason is required.",
    });
  }

  const now = new Date();

  const updated = await prisma.orderItem.update({
    where: { id: orderItemId, sellerId }, // sellerId in WHERE — ownership re-checked atomically
    data: {
      fulfillmentStatus: nextStatus,
      ...(nextStatus === "shipped"
        ? {
            shippedAt: now,
            sellerTrackingNumber: extra.trackingNumber,
            sellerTrackingUrl: extra.trackingUrl ?? null,
          }
        : {}),
      ...(nextStatus === "delivered" ? { deliveredAt: now } : {}),
      ...(nextStatus === "cancelled"
        ? { cancelledAt: now, cancellationReason: extra.cancellationReason }
        : {}),
    },
    include: ORDER_ITEM_INCLUDE,
  });

  // If this cancellation/confirmation was the seller's portion, restock
  // automatically on cancellation — mirrors the existing admin refund
  // flow's stock-restoration behaviour (Phase 6 of the original e-commerce
  // build, not the marketplace scaling doc) so the same product can be
  // resold once a seller cancels their line.
  if (nextStatus === "cancelled") {
    await prisma.product.update({
      where: { id: updated.productId },
      data: { stockQty: { increment: updated.quantity } },
    });
    // Phase 7: reverse the escrow hold — see escrow.service.ts's
    // refundEscrowHold() header comment for why this is necessary
    // (without it, captured funds for a cancelled line would never be
    // released OR refunded, silently locked in pendingBalance forever).
    await refundEscrowHold(orderItemId);
  }

  // Phase 7: delivery is what starts the 10-day escrow release clock.
  // This does NOT release any funds itself — see escrow.service.ts's
  // markEscrowDelivered() and the release job for that.
  if (nextStatus === "delivered" && updated.deliveredAt) {
    await markEscrowDelivered(orderItemId, updated.deliveredAt);
  }
if (nextStatus === "shipped" || nextStatus === "delivered") {
  await createNotification({
    userId: updated.order.userId,
    type: "order_status_changed",
    payload: {
      orderItemId,
      newStatus: nextStatus,
      productName: updated.productName,
    },
  });
}


  return toSellerLineItem(updated);
}

/**
 * Derives a single buyer-facing status string from all of an order's
 * per-seller fulfillment lines, for display on the buyer's order page.
 * This is the presentation-layer reconciliation referenced in the
 * migration's footer note — no schema change, computed on read.
 */
export function deriveBuyerFacingStatus(
  lineStatuses: OrderItemFulfillmentStatus[]
): "processing" | "partially_shipped" | "shipped" | "partially_delivered" | "delivered" | "cancelled" {
  if (lineStatuses.length === 0) return "processing";

  const allSame = (s: OrderItemFulfillmentStatus) => lineStatuses.every((x) => x === s);

  if (allSame("cancelled")) return "cancelled";
  if (allSame("delivered")) return "delivered";
  if (allSame("shipped")) return "shipped";

  const nonCancelled = lineStatuses.filter((s) => s !== "cancelled");
  if (nonCancelled.length === 0) return "cancelled";

  if (nonCancelled.some((s) => s === "delivered") && nonCancelled.some((s) => s !== "delivered")) {
    return "partially_delivered";
  }
  if (nonCancelled.some((s) => s === "shipped") && nonCancelled.some((s) => s === "pending" || s === "confirmed")) {
    return "partially_shipped";
  }
  if (nonCancelled.every((s) => s === "delivered")) return "delivered";
  if (nonCancelled.every((s) => s === "shipped")) return "shipped";

  return "processing";
}
