// ─────────────────────────────────────────────────────────────────────────
// lib/sellers/dispute.service.ts
//
// Phase 9 — Returns, Refunds & Dispute Resolution.
//
// ── State machine ────────────────────────────────────────────────────────
//
//   open  ──(seller accepts)──────────────────────► resolved_refunded
//     │
//     └──(seller responds/rejects)──► seller_review
//                                          │
//                  (seller escalates or    │
//                   buyer not satisfied)   │
//                                          ▼
//                                     admin_review
//                                          │
//                    ┌─────────────────────┴──────────────────────┐
//                    ▼                                            ▼
//            resolved_refunded                           resolved_denied
//
// ── Escrow integration ───────────────────────────────────────────────────
// openDispute() sets EscrowHold.status = "disputed", which blocks the
// release job from releasing funds while the dispute is open.
// resolveDispute(outcome="refund") reverses the escrow hold's ledger
// entries via a "refund" LedgerEntry, then releases whatever net remains
// (if any) to the seller. resolveDispute(outcome="deny") simply flips
// the hold back to "held" so the release job picks it up normally.
//
// ── Payout integration ───────────────────────────────────────────────────
// payout.service.ts checks for open disputes before allowing a payout
// request or marking one paid. That check queries EscrowHold.status =
// "disputed" for the seller — which is set here on openDispute().
// ─────────────────────────────────────────────────────────────────────────

import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors";
import { logAuditEvent } from "@/lib/audit";
import { postLedgerEntry } from "@/lib/wallet/ledger.service";
import { createNotification } from "@/lib/notifications/notifications.service";
import type { OpenDisputeInput, SellerRespondInput, AdminResolveInput } from "@/lib/validation/dispute";

// ── Internal helpers ──────────────────────────────────────────────────────

const OPEN_STATUSES = ["open", "seller_review", "admin_review"] as const;

async function getDisputeOrThrow(id: string) {
  const dispute = await prisma.dispute.findUnique({
    where: { id },
    include: {
      orderItem: {
        select: {
          id: true,
          orderId: true,
          sellerId: true,
          productName: true,
          quantity: true,
          unitPrice: true,
          totalPrice: true,
	order:  { select: { userId: true } },
	seller: { select: { userId: true } },
        },
      },
    },
  });
  if (!dispute) throw new AppError("VALIDATION_ERROR", { id: "Dispute not found." });
  return dispute;
}

// ── 1. Buyer opens a dispute ──────────────────────────────────────────────

export async function openDispute(params: {
  orderItemId: string;
  buyerUserId: string;
  input: OpenDisputeInput;
}) {
  // Verify buyer actually owns this order item
 const orderItem = await prisma.orderItem.findUnique({
  where: { id: params.orderItemId },
  include: {
    order: {
      select: {
        userId: true,
      },
    },
    seller: {
      select: {
        userId: true,
      },
    },
  },
});
  if (!orderItem) throw new AppError("VALIDATION_ERROR", { orderItemId: "Order item not found." });
  if (orderItem.order.userId !== params.buyerUserId) {
    throw new AppError("ADMIN_UNAUTHORISED");
  }

  // Prevent opening a new dispute while one is already active
  const existing = await prisma.dispute.findFirst({
    where: { orderItemId: params.orderItemId, status: { in: [...OPEN_STATUSES] } },
  });
  if (existing) {
    throw new AppError("VALIDATION_ERROR", {
      orderItemId: "A dispute is already open for this item. Wait for it to be resolved before opening another.",
    });
  }

  const dispute = await prisma.$transaction(async (tx) => {
    const d = await tx.dispute.create({
      data: {
        orderItemId: params.orderItemId,
        openedBy: "buyer",
        type: params.input.type,
        status: "open",
        buyerReason: params.input.buyerReason,
      },
    });

    // Block escrow release while dispute is open
    await tx.escrowHold.updateMany({
      where: { orderItemId: params.orderItemId, status: { not: "released" } },
      data: { status: "disputed" },
    });

    return d;
  });

  await logAuditEvent({
    userId: params.buyerUserId,
    action: "buyer.dispute_opened",
    resourceType: "dispute",
    resourceId: dispute.id,
    ipAddress: "internal",
    newValues: { type: params.input.type, orderItemId: params.orderItemId },
  });
await createNotification({
  userId: orderItem.seller.userId,
  type: "dispute_opened",
  payload: {
    disputeId: dispute.id,
    orderItemId: params.orderItemId,
    type: params.input.type,
  },
});

  return dispute;
}

// ── 2. Seller responds ────────────────────────────────────────────────────

export async function sellerRespondToDispute(params: {
  disputeId: string;
  sellerUserId: string;
  sellerId: string;
  input: SellerRespondInput;
}) {
  const dispute = await getDisputeOrThrow(params.disputeId);

  if (dispute.orderItem.sellerId !== params.sellerId) {
    throw new AppError("ADMIN_UNAUTHORISED");
  }
  if (!OPEN_STATUSES.includes(dispute.status as any)) {
    throw new AppError("VALIDATION_ERROR", { status: "This dispute has already been resolved." });
  }
  if (dispute.status === "admin_review") {
    throw new AppError("VALIDATION_ERROR", {
      status: "This dispute is under admin review — you can no longer respond directly.",
    });
  }

  let nextStatus: "resolved_refunded" | "seller_review" | "admin_review";

  if (params.input.action === "accept") {
    nextStatus = "resolved_refunded";
  } else if (params.input.action === "escalate") {
    nextStatus = "admin_review";
  } else {
    nextStatus = "seller_review";
  }

  const updated = await prisma.$transaction(async (tx) => {
    const d = await tx.dispute.update({
      where: { id: params.disputeId },
      data: {
        status: nextStatus,
        sellerResponse: params.input.sellerResponse,
        sellerResponseAt: new Date(),
        resolvedAt: nextStatus === "resolved_refunded" ? new Date() : null,
      },
    });

    if (nextStatus === "resolved_refunded") {
      // Seller accepted: full refund to buyer — reverse the escrow hold
      const hold = await tx.escrowHold.findUnique({
        where: { orderItemId: dispute.orderItemId },
      });
      if (hold) {
        await postLedgerEntry(
          {
            sellerId: dispute.orderItem.sellerId,
            orderItemId: dispute.orderItemId,
            entryType: "refund",
            amount: -Number(hold.grossAmount),
            idempotencyKey: `dispute:${params.disputeId}:refund`,
            note: `Full refund — seller accepted dispute ${params.disputeId}.`,
          },
          tx
        );
        await tx.escrowHold.update({
          where: { orderItemId: dispute.orderItemId },
          data: { status: "released", releasedAt: new Date() },
        });
        // Link the ledger entry to the dispute record for idempotency
        const ledgerEntry = await tx.ledgerEntry.findFirst({
          where: { idempotencyKey: `dispute:${params.disputeId}:refund` },
        });
        if (ledgerEntry) {
          await tx.dispute.update({
            where: { id: params.disputeId },
            data: {
              ledgerEntryId: ledgerEntry.id,
              refundAmount: hold.grossAmount,
            },
          });
        }
      }
    } else if (nextStatus !== "seller_review") {
      // Escalated to admin — keep escrow blocked (status stays "disputed")
    }

    return d;
  });

  await logAuditEvent({
    userId: params.sellerUserId,
    action: `seller.dispute_${params.input.action}ed`,
    resourceType: "dispute",
    resourceId: params.disputeId,
    ipAddress: "internal",
    newValues: { action: params.input.action },
  });

  return updated;
}

// ── 3. Admin resolves ─────────────────────────────────────────────────────

export async function adminResolveDispute(params: {
  disputeId: string;
  adminUserId: string;
  input: AdminResolveInput;
}) {
  const dispute = await getDisputeOrThrow(params.disputeId);

  if (!OPEN_STATUSES.includes(dispute.status as any)) {
    throw new AppError("VALIDATION_ERROR", { status: "This dispute has already been resolved." });
  }
  if (dispute.ledgerEntryId) {
    throw new AppError("VALIDATION_ERROR", {
      ledgerEntryId: "A refund ledger entry already exists for this dispute — it may have been resolved already.",
    });
  }

  const itemTotal = Number(dispute.orderItem.totalPrice);
  const refundAmount = params.input.refundAmount ?? itemTotal;

  if (params.input.outcome === "refund") {
    if (refundAmount <= 0 || refundAmount > itemTotal) {
      throw new AppError("VALIDATION_ERROR", {
        refundAmount: `Refund amount must be between 0.01 and ${itemTotal} (the order item total).`,
      });
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const now = new Date();

    if (params.input.outcome === "refund") {
      // Post refund ledger entry — deducts from seller's pendingBalance
      await postLedgerEntry(
        {
          sellerId: dispute.orderItem.sellerId,
          orderItemId: dispute.orderItemId,
          entryType: "refund",
          amount: -refundAmount,
          idempotencyKey: `dispute:${params.disputeId}:admin_refund`,
          note: `Admin resolved dispute ${params.disputeId} — ${
            refundAmount === itemTotal ? "full" : "partial"
          } refund of ${refundAmount}.`,
        },
        tx
      );

      // If partial refund: release the remainder to the seller
      if (refundAmount < itemTotal) {
        const netRelease = itemTotal - refundAmount;
        await postLedgerEntry(
          {
            sellerId: dispute.orderItem.sellerId,
            orderItemId: dispute.orderItemId,
            entryType: "release",
            amount: netRelease,
            idempotencyKey: `dispute:${params.disputeId}:partial_release`,
            note: `Partial release of ${netRelease} after ${refundAmount} refund on dispute ${params.disputeId}.`,
          },
          tx
        );
      }

      // Unblock the escrow hold (terminal — already-released is correct here
      // since the money has been accounted for via ledger entries above)
      await tx.escrowHold.updateMany({
        where: { orderItemId: dispute.orderItemId },
        data: { status: "released", releasedAt: now },
      });

      // Link ledger entry to dispute for idempotency guard
      const ledgerEntry = await tx.ledgerEntry.findFirst({
        where: { idempotencyKey: `dispute:${params.disputeId}:admin_refund` },
      });

      return tx.dispute.update({
        where: { id: params.disputeId },
        data: {
          status: "resolved_refunded",
          resolutionNotes: params.input.resolutionNotes,
          resolvedBy: params.adminUserId,
          resolvedAt: now,
          refundAmount,
          ledgerEntryId: ledgerEntry?.id ?? null,
        },
      });
    } else {
      // Denied — unblock escrow so release job can pick it up normally
      await tx.escrowHold.updateMany({
        where: { orderItemId: dispute.orderItemId, status: "disputed" },
        data: { status: "held" },
      });

      return tx.dispute.update({
        where: { id: params.disputeId },
        data: {
          status: "resolved_denied",
          resolutionNotes: params.input.resolutionNotes,
          resolvedBy: params.adminUserId,
          resolvedAt: now,
        },
      });
    }
  });

  await logAuditEvent({
    userId: params.adminUserId,
    action: `admin.dispute_resolved_${params.input.outcome}`,
    resourceType: "dispute",
    resourceId: params.disputeId,
    ipAddress: "internal",
    newValues: {
      outcome: params.input.outcome,
      refundAmount: params.input.outcome === "refund" ? refundAmount : null,
    },
  });
await createNotification({
  userId: dispute.orderItem.order.userId,
  type: "dispute_resolved",
  payload: {
    disputeId: params.disputeId,
    outcome: updated.status,
  },
});

await createNotification({
  userId: dispute.orderItem.seller.userId,
  type: "dispute_resolved",
  payload: {
    disputeId: params.disputeId,
    outcome: updated.status,
  },
});
  return updated;
}

// ── 4. Query helpers ──────────────────────────────────────────────────────

export async function getDisputesForSeller(
  sellerId: string,
  params: { status?: string; page?: number; pageSize?: number } = {}
) {
  const { page = 1, pageSize = 20, status } = params;

  const where = {
    orderItem: { sellerId },
    ...(status ? { status: status as any } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.dispute.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        orderItem: {
          select: {
            id: true,
            productName: true,
            totalPrice: true,

            order: { select: { orderNumber: true } },
          },
        },
      },
    }),
    prisma.dispute.count({ where }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function getDisputeQueueForAdmin(params: {
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  const { page = 1, pageSize = 25, status } = params;

  const where = status ? { status: status as any } : {};

  const [items, total] = await Promise.all([
    prisma.dispute.findMany({
      where,
      orderBy: { createdAt: "asc" }, // oldest first — FIFO
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        orderItem: {
          select: {
            id: true,
            productName: true,
            totalPrice: true,
            sellerId: true,
            order: {
              select: {
                orderNumber: true,
                userId: true,
                user: { select: { fullName: true, email: true } },
              },
            },
          },
        },
      },
    }),
    prisma.dispute.count({ where }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}
