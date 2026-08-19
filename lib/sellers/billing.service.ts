// ─────────────────────────────────────────────────────────────────────────
// lib/sellers/billing.service.ts
//
// Trial start, trial-expiry checking, and grace-period suspension are all
// fully real and functional. Actually CHARGING a card/wallet is not —
// there is no recurring-billing-capable payment gateway integrated yet
// (see CODEBASE_AUDIT.md and the Phase 4 build notes). chargeSubscription()
// below throws an honest "not yet configured" error, mirroring the exact
// pattern lib/payments/provider.ts already uses for unconfigured buyer
// payment methods — this is a single, clean extension point for whoever
// wires up a real gateway later, not a silent fake-success.
//
// IMPORTANT: there is no background job scheduler anywhere in this app
// (no cron, no queue worker). checkAndUpdateTrialExpiry() is therefore
// called OPPORTUNISTICALLY — every time a seller loads their dashboard or
// billing page (see the GET /api/sellers/subscription and
// /api/sellers/dashboard routes). This means a trial that ends at 3am
// won't flip to past_due until the seller (or anyone hitting those
// routes) next loads the page — not the exact moment it expires. Fine
// for this phase; flagged clearly so it's not mistaken for a real cron.
// ─────────────────────────────────────────────────────────────────────────

import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors";
import { logAuditEvent } from "@/lib/audit";
import { transitionSellerStatus } from "@/lib/sellers/seller.service";

const TRIAL_DAYS = 30;
const PAST_DUE_GRACE_DAYS = 7;

const PLAN_PRICE_USD: Record<"individual" | "business", number> = {
  individual: 15,
  business: 60,
};

/**
 * Called once, automatically, right after createStoreForSeller() — see
 * verification.service.ts's approval branch. Not exposed as a route.
 */
export async function startTrialForSeller(params: {
  sellerId: string;
  sellerType: "individual" | "business";
}) {
  const existing = await prisma.sellerSubscription.findUnique({ where: { sellerId: params.sellerId } });
  if (existing) return existing;

  const trialEndAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

  const subscription = await prisma.sellerSubscription.create({
    data: {
      sellerId: params.sellerId,
      plan: params.sellerType,
      status: "trialing",
      trialEndAt,
    },
  });

  await logAuditEvent({
    action: "seller.trial_started",
    resourceType: "seller_subscription",
    resourceId: subscription.id,
    ipAddress: "internal",
    newValues: { sellerId: params.sellerId, plan: params.sellerType, trialEndAt },
  });

  return subscription;
}

export async function getSubscriptionForSeller(sellerId: string) {
  return checkAndUpdateTrialExpiry(sellerId);
}

/**
 * Opportunistic state-machine check — see file header. Always returns the
 * subscription in its CURRENT, up-to-date state, transitioning it first
 * if needed. Safe to call on every page load; it's a no-op read if
 * nothing has actually changed.
 */
export async function checkAndUpdateTrialExpiry(sellerId: string) {
  const sub = await prisma.sellerSubscription.findUnique({ where: { sellerId } });
  if (!sub) return null;

  const now = new Date();

  // Trial just ended, no real charge exists to attempt yet — move to
  // past_due (payment is genuinely due; we just can't collect it
  // automatically yet) and create the invoice that, once a real gateway
  // exists, charging would settle.
  if (sub.status === "trialing" && sub.trialEndAt < now) {
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const updated = await prisma.$transaction(async (tx) => {
      await tx.subscriptionInvoice.create({
        data: {
          sellerId,
          amount: PLAN_PRICE_USD[sub.plan],
          currency: "USD",
          status: "pending",
          billingPeriodStart: sub.trialEndAt,
          billingPeriodEnd: periodEnd,
        },
      });
      return tx.sellerSubscription.update({
        where: { sellerId },
        data: { status: "past_due", pastDueSince: now },
      });
    });

    await logAuditEvent({
      action: "seller.subscription_past_due",
      resourceType: "seller_subscription",
      resourceId: sub.id,
      ipAddress: "internal",
      newValues: { reason: "trial_ended_no_payment_processor" },
    });

    return updated;
  }

  // Grace period exhausted — suspend the seller account. Seller.status
  // already has "suspended" as a real, pre-existing value (Phase 1/2) —
  // this is just a second, automatic trigger for it alongside the
  // existing admin-initiated one.
  if (sub.status === "past_due" && sub.pastDueSince) {
    const graceDeadline = new Date(sub.pastDueSince.getTime() + PAST_DUE_GRACE_DAYS * 24 * 60 * 60 * 1000);
    if (now > graceDeadline) {
      const seller = await prisma.seller.findUnique({ where: { id: sellerId }, select: { status: true } });
      if (seller?.status === "active") {
        await transitionSellerStatus(sellerId, "suspended", "system:billing");
      }
      const updated = await prisma.sellerSubscription.update({
        where: { sellerId },
        data: { status: "cancelled" },
      });

      await logAuditEvent({
        action: "seller.subscription_cancelled_grace_expired",
        resourceType: "seller_subscription",
        resourceId: sub.id,
        ipAddress: "internal",
      });

      return updated;
    }
  }

  return sub;
}

/**
 * THE STUB. Throws until a real recurring-billing gateway is wired up.
 * Mirrors lib/payments/provider.ts's exact pattern for unconfigured
 * buyer payment methods — fail loud and clear, never fake success.
 */
export async function chargeSubscription(_sellerId: string): Promise<never> {
  throw new AppError("VALIDATION_ERROR", {
    billing: "Automatic subscription charging is not yet configured. No recurring-billing payment gateway is integrated — see CODEBASE_AUDIT.md.",
  });
}

/**
 * Webhook handler stub. Deliberately FAIL-CLOSED: with no real gateway
 * configured, EVERY call is rejected as unverified, never silently
 * accepted. This is the correct default for a stub — a no-op that
 * returned 200 OK would be worse than not existing, since it would look
 * like working webhook infrastructure during testing.
 */
export async function handleSubscriptionWebhook(_rawBody: string, _signatureHeader: string | null): Promise<never> {
  throw new AppError("VALIDATION_ERROR", {
    webhook: "No payment gateway is configured to send subscription webhooks yet. This endpoint exists as a wiring point, not a working integration.",
  });
}
