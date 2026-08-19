// ─────────────────────────────────────────────────────────────────────────
// lib/wallet/commission.service.ts
//
// Looks up the commission rate that was IN EFFECT at a specific point in
// time — not "today's" rate. This is what makes a future rate change
// never retroactively alter an order that already released. Every call
// site passes the order line's deliveredAt (the moment its 10-day clock
// started), not the current date.
// ─────────────────────────────────────────────────────────────────────────

import { prisma } from "@/lib/db/prisma";
import type { SellerType } from "@prisma/client";

export async function getCommissionRate(
  sellerType: SellerType,
  atDate: Date
): Promise<number> {
  const config = await prisma.commissionConfig.findFirst({
    where: {
      sellerType,
      effectiveFrom: { lte: atDate },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: atDate } }],
    },
    orderBy: { effectiveFrom: "desc" },
  });

  if (!config) {
    // Should never happen post-migration (both rates are seeded), but
    // fail loudly rather than silently charging 0% commission if it ever
    // does — a missing config row is a real bug worth surfacing.
    throw new Error(
      `No commission rate configured for sellerType=${sellerType} at ${atDate.toISOString()}. Check commissions_config has an open-ended or covering row.`
    );
  }

  return Number(config.ratePercent);
}

/**
 * Admin action: ends the currently-open-ended rate for a seller type and
 * starts a new one. Not exposed as a route in this phase's acceptance
 * criteria (only the two seed rates are required to exist) — provided so
 * a future admin settings page has a ready-made, correct function to
 * call rather than reinventing the versioning logic.
 */
export async function setCommissionRate(sellerType: SellerType, newRatePercent: number) {
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    await tx.commissionConfig.updateMany({
      where: { sellerType, effectiveTo: null },
      data: { effectiveTo: now },
    });
    return tx.commissionConfig.create({
      data: { sellerType, ratePercent: newRatePercent, effectiveFrom: now },
    });
  });
}
