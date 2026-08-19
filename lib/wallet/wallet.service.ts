// ─────────────────────────────────────────────────────────────────────────
// lib/wallet/wallet.service.ts
// ─────────────────────────────────────────────────────────────────────────

import { prisma } from "@/lib/db/prisma";

/**
 * Called once, automatically, from verification.service.ts's approval
 * branch, alongside createStoreForSeller() and startTrialForSeller().
 * Idempotent — returns the existing wallet if one is somehow already
 * there, never creates a duplicate.
 */
export async function createWalletForSeller(sellerId: string) {
  const existing = await prisma.wallet.findUnique({ where: { sellerId } });
  if (existing) return existing;

  return prisma.wallet.create({
    data: { sellerId, pendingBalance: 0, availableBalance: 0, heldBalance: 0, currency: "PKR" },
  });
}
