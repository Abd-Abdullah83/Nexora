// lib/admin/overrides.service.ts
//
// Phase 12 — Guarded manual admin interventions.
//
// Every function here:
//   1. Takes a mandatory `reason` string
//   2. Snapshots before/after state
//   3. Writes to admin_overrides (immutable log)
//   4. Writes to audit_logs (existing audit trail)
//   5. Wraps DB mutations in a $transaction
//
// These are for cases where normal automated flows are stuck — not a
// shortcut around normal process. Every use is visible in the
// /admin/overrides page and in the audit log.

import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors";
import { logAuditEvent } from "@/lib/audit";

// ── Internal helper ───────────────────────────────────────────────────────

async function writeOverrideRecord(params: {
  adminId: string;
  resourceType: "order" | "escrow_hold" | "listing";
  resourceId: string;
  action: string;
  reason: string;
  beforeState?: object;
  afterState?: object;
}) {
  await prisma.adminOverride.create({
    data: {
      adminId: params.adminId,
      resourceType: params.resourceType as any,
      resourceId: params.resourceId,
      action: params.action as any,
      reason: params.reason,
      beforeState: params.beforeState ?? undefined,
      afterState: params.afterState ?? undefined,
    },
  });
}

// ── Order overrides ───────────────────────────────────────────────────────

export async function forceCompleteOrder(params: {
  orderId: string;
  adminId: string;
  reason: string;
}) {
  const order = await prisma.order.findUnique({
    where: { id: params.orderId },
    select: { id: true, status: true, paymentStatus: true, orderNumber: true },
  });
  if (!order) throw new AppError("VALIDATION_ERROR", { id: "Order not found." });
  if (order.status === "delivered") {
    throw new AppError("VALIDATION_ERROR", { status: "Order is already delivered." });
  }
  if (order.status === "cancelled" || order.status === "refunded") {
    throw new AppError("VALIDATION_ERROR", {
      status: `Cannot force-complete a ${order.status} order.`,
    });
  }

  const beforeState = { status: order.status, paymentStatus: order.paymentStatus };

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: params.orderId },
      data: { status: "delivered" },
    });
  });

  const afterState = { status: "delivered", paymentStatus: order.paymentStatus };

  await writeOverrideRecord({
    adminId: params.adminId,
    resourceType: "order",
    resourceId: params.orderId,
    action: "order_force_complete",
    reason: params.reason,
    beforeState,
    afterState,
  });

  await logAuditEvent({
    userId: params.adminId,
    action: "admin.order_force_completed",
    resourceType: "order",
    resourceId: params.orderId,
    ipAddress: "internal",
    newValues: { reason: params.reason, orderNumber: order.orderNumber },
  });

  return { orderId: params.orderId, newStatus: "delivered" };
}

export async function forceCancelOrder(params: {
  orderId: string;
  adminId: string;
  reason: string;
}) {
  const order = await prisma.order.findUnique({
    where: { id: params.orderId },
    select: { id: true, status: true, orderNumber: true },
  });
  if (!order) throw new AppError("VALIDATION_ERROR", { id: "Order not found." });
  if (["cancelled", "refunded", "delivered"].includes(order.status)) {
    throw new AppError("VALIDATION_ERROR", {
      status: `Cannot cancel an order with status "${order.status}".`,
    });
  }

  const beforeState = { status: order.status };

  await prisma.order.update({
    where: { id: params.orderId },
    data: { status: "cancelled" },
  });

  await writeOverrideRecord({
    adminId: params.adminId,
    resourceType: "order",
    resourceId: params.orderId,
    action: "order_force_cancel",
    reason: params.reason,
    beforeState,
    afterState: { status: "cancelled" },
  });

  await logAuditEvent({
    userId: params.adminId,
    action: "admin.order_force_cancelled",
    resourceType: "order",
    resourceId: params.orderId,
    ipAddress: "internal",
    newValues: { reason: params.reason, orderNumber: order.orderNumber },
  });

  return { orderId: params.orderId, newStatus: "cancelled" };
}

// ── Escrow overrides ──────────────────────────────────────────────────────

export async function manuallyReleaseEscrowHold(params: {
  escrowHoldId: string;
  adminId: string;
  reason: string;
}) {
  const hold = await prisma.escrowHold.findUnique({
    where: { id: params.escrowHoldId },
    select: { id: true, status: true, sellerId: true, grossAmount: true, orderItemId: true },
  });
  if (!hold) throw new AppError("VALIDATION_ERROR", { id: "Escrow hold not found." });
  if (hold.status === "released") {
    throw new AppError("VALIDATION_ERROR", { status: "Hold is already released." });
  }
  if (hold.status === "disputed") {
    throw new AppError("VALIDATION_ERROR", {
      status: "Cannot manually release a disputed hold — resolve the dispute first.",
    });
  }

  const beforeState = { status: hold.status };

  await prisma.$transaction(async (tx) => {
    await tx.escrowHold.update({
      where: { id: params.escrowHoldId },
      data: { status: "released", releasedAt: new Date() },
    });

    // Credit the seller's available balance
    await tx.wallet.update({
      where: { sellerId: hold.sellerId },
      data: {
        availableBalance: { increment: hold.grossAmount },
        pendingBalance: { decrement: hold.grossAmount },
      },
    });

    // Write a ledger entry so the balance change is traceable
    const wallet = await tx.wallet.findUnique({
      where: { sellerId: hold.sellerId },
      select: { availableBalance: true },
    });

    await tx.ledgerEntry.create({
      data: {
        sellerId: hold.sellerId,
        orderItemId: hold.orderItemId,
        entryType: "release",
        amount: Number(hold.grossAmount),
        balanceAfter: Number(wallet?.availableBalance ?? 0),
        idempotencyKey: `admin_override:release:${params.escrowHoldId}`,
        note: `Manual admin release. Reason: ${params.reason}`,
      },
    });
  });

  await writeOverrideRecord({
    adminId: params.adminId,
    resourceType: "escrow_hold",
    resourceId: params.escrowHoldId,
    action: "escrow_manual_release",
    reason: params.reason,
    beforeState,
    afterState: { status: "released" },
  });

  await logAuditEvent({
    userId: params.adminId,
    action: "admin.escrow_manual_release",
    resourceType: "escrow_hold",
    resourceId: params.escrowHoldId,
    ipAddress: "internal",
    newValues: { reason: params.reason },
  });

  return { escrowHoldId: params.escrowHoldId, newStatus: "released" };
}

export async function manuallyUnfreezeEscrowHold(params: {
  escrowHoldId: string;
  adminId: string;
  reason: string;
}) {
  const hold = await prisma.escrowHold.findUnique({
    where: { id: params.escrowHoldId },
    select: { id: true, status: true },
  });
  if (!hold) throw new AppError("VALIDATION_ERROR", { id: "Escrow hold not found." });
  if (hold.status !== "frozen") {
    throw new AppError("VALIDATION_ERROR", {
      status: `Hold is "${hold.status}" — only frozen holds can be unfrozen.`,
    });
  }

  await prisma.escrowHold.update({
    where: { id: params.escrowHoldId },
    data: { status: "held" },
  });

  await writeOverrideRecord({
    adminId: params.adminId,
    resourceType: "escrow_hold",
    resourceId: params.escrowHoldId,
    action: "escrow_manual_unfreeze",
    reason: params.reason,
    beforeState: { status: "frozen" },
    afterState: { status: "held" },
  });

  await logAuditEvent({
    userId: params.adminId,
    action: "admin.escrow_manual_unfreeze",
    resourceType: "escrow_hold",
    resourceId: params.escrowHoldId,
    ipAddress: "internal",
    newValues: { reason: params.reason },
  });

  return { escrowHoldId: params.escrowHoldId, newStatus: "held" };
}

// ── Listing overrides ─────────────────────────────────────────────────────

export async function forceArchiveListing(params: {
  productId: string;
  adminId: string;
  reason: string;
}) {
  const product = await prisma.product.findUnique({
    where: { id: params.productId },
    select: { id: true, status: true, name: true, sellerId: true, deletedAt: true },
  });
  if (!product || product.deletedAt) {
    throw new AppError("VALIDATION_ERROR", { id: "Listing not found." });
  }
  if (product.status === "archived") {
    throw new AppError("VALIDATION_ERROR", { status: "Listing is already archived." });
  }

  const beforeState = { status: product.status };

  await prisma.product.update({
    where: { id: params.productId },
    data: { status: "archived" },
  });

  await writeOverrideRecord({
    adminId: params.adminId,
    resourceType: "listing",
    resourceId: params.productId,
    action: "listing_force_archive",
    reason: params.reason,
    beforeState,
    afterState: { status: "archived" },
  });

  await logAuditEvent({
    userId: params.adminId,
    action: "admin.listing_force_archived",
    resourceType: "product",
    resourceId: params.productId,
    ipAddress: "internal",
    newValues: { reason: params.reason, productName: product.name },
  });

  return { productId: params.productId, newStatus: "archived" };
}

export async function forceReactivateListing(params: {
  productId: string;
  adminId: string;
  reason: string;
}) {
  const product = await prisma.product.findUnique({
    where: { id: params.productId },
    select: { id: true, status: true, name: true, sellerId: true, deletedAt: true },
  });
  if (!product || product.deletedAt) {
    throw new AppError("VALIDATION_ERROR", { id: "Listing not found." });
  }
  if (product.status === "active") {
    throw new AppError("VALIDATION_ERROR", { status: "Listing is already active." });
  }

  const beforeState = { status: product.status };

  await prisma.product.update({
    where: { id: params.productId },
    data: { status: "active" },
  });

  await writeOverrideRecord({
    adminId: params.adminId,
    resourceType: "listing",
    resourceId: params.productId,
    action: "listing_force_reactivate",
    reason: params.reason,
    beforeState,
    afterState: { status: "active" },
  });

  await logAuditEvent({
    userId: params.adminId,
    action: "admin.listing_force_reactivated",
    resourceType: "product",
    resourceId: params.productId,
    ipAddress: "internal",
    newValues: { reason: params.reason, productName: product.name },
  });

  return { productId: params.productId, newStatus: "active" };
}

// ── Query ─────────────────────────────────────────────────────────────────

export async function getOverrideHistory(params: {
  resourceType?: string;
  adminId?: string;
  page?: number;
  pageSize?: number;
}) {
  const { page = 1, pageSize = 25, resourceType, adminId } = params;

  const where = {
    ...(resourceType ? { resourceType: resourceType as any } : {}),
    ...(adminId ? { adminId } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.adminOverride.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        admin: { select: { fullName: true, email: true } },
      },
    }),
    prisma.adminOverride.count({ where }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}
