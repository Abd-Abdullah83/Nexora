// ─────────────────────────────────────────────────────────────────────────
// lib/wallet/escrow.service.ts
//
// The financial state machine: capture -> hold -> (delivery + 10 days) ->
// release, with commission and subscription dues deducted at release.
//
// ── Why "payment capture" hooks into confirmOrderPayment(), not a
// real gateway event ──────────────────────────────────────────────────
// Per CODEBASE_AUDIT.md (Phase 0) and the Phase 4 build notes: no real
// payment gateway with a genuine "capture" webhook is integrated yet —
// only COD is live, and COD has no clean "funds captured by the
// platform" moment (the courier collects cash, not Nexora). The closest
// real analog in this codebase is `confirmOrderPayment()` in
// order.repository.ts — the function an admin's "Mark as Paid" button
// calls, and the SAME function a future real webhook would call once a
// gateway exists. Hooking escrow-hold creation there is therefore the
// most honest available choice: it's the one place in the system that
// already represents "the platform considers this order's money real."
// When a true gateway is integrated, its webhook handler should call
// confirmOrderPayment() exactly as the admin button does today — at
// which point escrow hold creation needs zero changes, it already fires
// from the right place.
//
// ── Why the release job is a function you call, not a cron job ─────────
// Per the doc's own Risk note: "given team size, consider keeping the
// scheduled release job's first version manually triggered by an Admin
// button rather than fully automatic." There is also no job
// scheduler/cron anywhere in this codebase to begin with (same gap noted
// for billing.service.ts's trial-expiry check). runEscrowReleaseJob()
// below does the real work; POST /api/admin/escrow/run-release-job is
// the admin button that calls it. Wiring this to an actual daily cron
// later is a deployment-infra change, not a logic change — the function
// itself doesn't need to know who/what is calling it.
// ─────────────────────────────────────────────────────────────────────────

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors";
import { logAuditEvent } from "@/lib/audit";
import { postLedgerEntry } from "@/lib/wallet/ledger.service";
import { getCommissionRate } from "@/lib/wallet/commission.service";

const RELEASE_WINDOW_DAYS = 10;

// ── Idempotency key helpers ──────────────────────────────────────────────
// One key per (orderItemId, entryType) pair, per the security review's
// explicit requirement. Centralized here so escrow.service.ts and any
// future caller never invent their own ad-hoc key format.
const keyFor = (orderItemId: string, entryType: string) => `${orderItemId}:${entryType}`;

// ── 1. Hold creation, on payment capture ──────────────────────────────────

/**
 * Creates one escrow hold per order line, for every line in the order.
 * Called from confirmOrderPayment() — see file header for why that's the
 * right hook point today. Idempotent at the DB level via the unique
 * constraint on EscrowHold.orderItemId; safe to call twice for the same
 * order (e.g. a retried admin click) without creating duplicate holds.
 */
export async function createEscrowHoldsForOrder(
  tx: Prisma.TransactionClient,
  orderItems: { id: string; sellerId: string; totalPrice: unknown }[]
) {
  for (const item of orderItems) {
    const existing = await tx.escrowHold.findUnique({ where: { orderItemId: item.id } });
    if (existing) continue; // already held — idempotent no-op

    await tx.escrowHold.create({
      data: {
        orderItemId: item.id,
        sellerId: item.sellerId,
        status: "held",
        grossAmount: item.totalPrice as any,
      },
    });

    await postLedgerEntry(
      {
        sellerId: item.sellerId,
        orderItemId: item.id,
        entryType: "escrow_hold",
        amount: Number(item.totalPrice),
        idempotencyKey: keyFor(item.id, "escrow_hold"),
        note: "Funds captured into escrow on payment confirmation.",
      },
      tx
    );
  }
}

// ── 2. Delivery starts the 10-day clock ───────────────────────────────────

/**
 * Called from seller-orders.service.ts's updateFulfillmentStatus(), only
 * in the branch where nextStatus === "delivered". Sets the release
 * clock — does NOT release funds itself. A hold that's frozen or
 * disputed still gets its deliveredAt/releaseEligibleAt set normally;
 * those statuses are what BLOCK the release job from acting on it later,
 * not a reason to skip recording delivery.
 */
export async function markEscrowDelivered(orderItemId: string, deliveredAt: Date) {
  const releaseEligibleAt = new Date(deliveredAt.getTime() + RELEASE_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const hold = await prisma.escrowHold.findUnique({ where: { orderItemId } });
  if (!hold) {
    // No hold exists — this order line's payment was never captured
    // through confirmOrderPayment() (shouldn't happen for a normal COD
    // flow, but defensive: don't throw and block the fulfillment update,
    // just skip silently — there's nothing for escrow to track).
    return null;
  }

  return prisma.escrowHold.update({
    where: { orderItemId },
    data: { deliveredAt, releaseEligibleAt },
  });
}

// ── 2.5. Refund — for a line cancelled before delivery ────────────────────

/**
 * Reverses an escrow hold that will never be delivered. Called from
 * seller-orders.service.ts's updateFulfillmentStatus(), in the
 * "cancelled" branch — a line can only be cancelled from "pending" or
 * "confirmed" (per Phase 6's ALLOWED_TRANSITIONS), i.e. always BEFORE
 * delivery, so its escrow hold is always still "held" with no
 * releaseEligibleAt set. Without this, a cancelled line's captured funds
 * would sit in pendingBalance forever — never released (nothing to
 * deliver), never refunded (nothing reverses it) — a silent accounting
 * leak, not a crash, which is why it's easy to miss.
 */
export async function refundEscrowHold(orderItemId: string) {
  const hold = await prisma.escrowHold.findUnique({ where: { orderItemId } });
  if (!hold) return null; // no hold exists — nothing to reverse
  if (hold.status === "released") {
    // Already released to the seller before cancellation was somehow
    // processed — should not happen given the state machine, but if it
    // does, do NOT claw back an already-released amount automatically;
    // that's a manual admin adjustment decision, not an automatic one.
    return hold;
  }

  await prisma.$transaction(async (tx) => {
    await postLedgerEntry(
      {
        sellerId: hold.sellerId,
        orderItemId: hold.orderItemId,
        entryType: "refund",
        amount: -Number(hold.grossAmount),
        idempotencyKey: keyFor(hold.orderItemId, "refund"),
        note: "Order line cancelled before delivery — escrow hold reversed.",
      },
      tx
    );
    await tx.escrowHold.update({
      where: { orderItemId },
      data: { status: "released", releasedAt: new Date() }, // terminal — funds are gone, not held
    });
  });

  return hold;
}

// ── 3. The release job ────────────────────────────────────────────────────

export interface ReleaseJobResult {
  checked: number;
  released: number;
  skipped: { orderItemId: string; reason: string }[];
}

/**
 * Finds every hold past its release_eligible_at with status still "held"
 * (frozen/disputed/released are all correctly excluded by this WHERE
 * clause alone), and releases each one: deducts commission (rate looked
 * up AS OF deliveredAt, not today) and any due subscription fee, credits
 * the net to the seller's available balance.
 *
 * Per the doc's acceptance criteria, this is safe to call repeatedly —
 * postLedgerEntry()'s idempotency means a hold already moved to
 * "released" status will simply be excluded by the WHERE clause on the
 * next run; one already in "held" status that already has its "release"
 * ledger entry posted (a crash between the status update and ledger post
 * is the one edge case) will just have its ledger entry no-op on retry,
 * never double-credited.
 */
export async function runEscrowReleaseJob(actorUserId: string): Promise<ReleaseJobResult> {
  const now = new Date();

  // Phase 9 live: the disputes table now exists. The WHERE clause below
  // already excludes "disputed" holds via status: "held" — EscrowHold
  // status is set to "disputed" by dispute.service.ts's openDispute()
  // and only set back to "held" (or "released") by adminResolveDispute().
  // So filtering status = "held" is still the correct and complete check —
  // any hold with an open dispute is status "disputed", not "held", and
  // will never appear in this query. No additional JOIN or subquery needed.
  const eligible = await prisma.escrowHold.findMany({
    where: {
      status: "held",
      releaseEligibleAt: { lte: now },
    },
    include: {
      orderItem: { select: { id: true } },
      seller: { select: { id: true, sellerType: true } },
    },
  });

  const result: ReleaseJobResult = { checked: eligible.length, released: 0, skipped: [] };

  for (const hold of eligible) {
    try {
      await releaseOneHold(hold, actorUserId);
      result.released++;
    } catch (err) {
      result.skipped.push({
        orderItemId: hold.orderItemId,
        reason: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  await logAuditEvent({
    userId: actorUserId,
    action: "admin.escrow_release_job_run",
    resourceType: "escrow_release_job",
    ipAddress: "internal",
    newValues: result,
  });

  return result;
}

async function releaseOneHold(
  hold: { id: string; orderItemId: string; sellerId: string; grossAmount: unknown; deliveredAt: Date | null; seller: { sellerType: any } },
  actorUserId: string
) {
  if (!hold.deliveredAt) {
    throw new Error("Hold is release-eligible but has no deliveredAt — data inconsistency, skipped.");
  }

  const gross = Number(hold.grossAmount);
  const ratePercent = await getCommissionRate(hold.seller.sellerType, hold.deliveredAt);
  const commissionAmount = Math.round(gross * (ratePercent / 100) * 100) / 100;

  // Fold in any due subscription fee at release time, per the doc's
  // "Subscription due reconciliation folded into the same release
  // event where applicable." Only reconciles ONE pending invoice per
  // release (the oldest), to avoid one large order's release wiping out
  // an unrelated number of unpaid periods in a single ledger entry.
  const dueInvoice = await prisma.subscriptionInvoice.findFirst({
    where: { sellerId: hold.sellerId, status: "pending" },
    orderBy: { billingPeriodStart: "asc" },
  });
  const subscriptionFeeAmount = dueInvoice ? Math.min(Number(dueInvoice.amount), gross - commissionAmount) : 0;

  const netAmount = gross - commissionAmount - subscriptionFeeAmount;

  await prisma.$transaction(async (tx) => {
    // Commission deduction
    if (commissionAmount > 0) {
      await postLedgerEntry(
        {
          sellerId: hold.sellerId,
          orderItemId: hold.orderItemId,
          entryType: "commission",
          amount: -commissionAmount,
          idempotencyKey: keyFor(hold.orderItemId, "commission"),
          note: `${ratePercent}% commission (${hold.seller.sellerType}) at delivery date.`,
        },
        tx
      );
    }

    // Subscription fee deduction, if any was due
    if (subscriptionFeeAmount > 0 && dueInvoice) {
      await postLedgerEntry(
        {
          sellerId: hold.sellerId,
          orderItemId: hold.orderItemId,
          entryType: "subscription_fee",
          amount: -subscriptionFeeAmount,
          idempotencyKey: keyFor(hold.orderItemId, `subscription_fee:${dueInvoice.id}`),
          note: `Subscription due reconciled at release (invoice ${dueInvoice.id}).`,
        },
        tx
      );
      if (subscriptionFeeAmount >= Number(dueInvoice.amount)) {
        await tx.subscriptionInvoice.update({
          where: { id: dueInvoice.id },
          data: { status: "paid", paidAt: new Date() },
        });
      }
    }

    // Net release to seller's available balance
    await postLedgerEntry(
      {
        sellerId: hold.sellerId,
        orderItemId: hold.orderItemId,
        entryType: "release",
        amount: netAmount,
        idempotencyKey: keyFor(hold.orderItemId, "release"),
        note: `Net release: ${gross} gross - ${commissionAmount} commission - ${subscriptionFeeAmount} subscription fee.`,
      },
      tx
    );

    await tx.escrowHold.update({
      where: { id: hold.id },
      data: { status: "released", releasedAt: new Date() },
    });
  });
}

// ── 4. Admin manual hold / unfreeze ───────────────────────────────────────

export async function freezeEscrowHold(params: {
  escrowHoldId: string;
  reason: string;
  adminUserId: string;
}) {
  const hold = await prisma.escrowHold.findUnique({ where: { id: params.escrowHoldId } });
  if (!hold) throw new AppError("VALIDATION_ERROR", { id: "Escrow hold not found." });
  if (hold.status === "released") {
    throw new AppError("VALIDATION_ERROR", { status: "Cannot freeze a hold that has already been released." });
  }

  const updated = await prisma.escrowHold.update({
    where: { id: params.escrowHoldId },
    data: { status: "frozen", frozenAt: new Date(), frozenBy: params.adminUserId, freezeReason: params.reason },
  });

  await logAuditEvent({
    userId: params.adminUserId,
    action: "admin.escrow_hold_frozen",
    resourceType: "escrow_hold",
    resourceId: params.escrowHoldId,
    ipAddress: "internal",
    newValues: { reason: params.reason },
  });

  return updated;
}

export async function unfreezeEscrowHold(escrowHoldId: string, adminUserId: string) {
  const hold = await prisma.escrowHold.findUnique({ where: { id: escrowHoldId } });
  if (!hold) throw new AppError("VALIDATION_ERROR", { id: "Escrow hold not found." });
  if (hold.status !== "frozen") {
    throw new AppError("VALIDATION_ERROR", { status: "Only a frozen hold can be unfrozen." });
  }

  const updated = await prisma.escrowHold.update({
    where: { id: escrowHoldId },
    data: { status: "held", frozenAt: null, frozenBy: null, freezeReason: null },
  });

  await logAuditEvent({
    userId: adminUserId,
    action: "admin.escrow_hold_unfrozen",
    resourceType: "escrow_hold",
    resourceId: escrowHoldId,
    ipAddress: "internal",
  });

  return updated;
}

// ── 5. Admin oversight queries ────────────────────────────────────────────

export async function getEscrowQueue(params: { status?: "held" | "released" | "frozen" | "disputed"; page?: number; pageSize?: number }) {
  const { status, page = 1, pageSize = 25 } = params;
  const where = status ? { status } : {};

  const [items, total] = await Promise.all([
    prisma.escrowHold.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        seller: { select: { id: true, displayName: true, sellerType: true } },
        orderItem: { select: { id: true, productName: true, orderId: true } },
      },
    }),
    prisma.escrowHold.count({ where }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}
