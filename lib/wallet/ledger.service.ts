// ─────────────────────────────────────────────────────────────────────────
// lib/wallet/ledger.service.ts
//
// THE single place in this entire codebase allowed to change a wallet's
// balance fields. No route, no other service, nothing else may call
// `prisma.wallet.update()` with a balance field — everything goes through
// postLedgerEntry() below, inside the SAME transaction as the ledger row
// it creates. This is what makes "sum of ledger_entries == wallet balance"
// a structural guarantee, not just something that happens to be true if
// every call site remembers to do it right (see verifyWalletReconciliation
// at the bottom — Phase 7's acceptance criteria, made into a runnable
// check).
//
// IDEMPOTENCY: every call MUST pass a unique idempotencyKey derived from
// (orderItemId, entryType) — see ESCROW_HOLD_KEY/COMMISSION_KEY/etc.
// helpers in escrow.service.ts. If a key has already been used, this is a
// silent no-op (returns the EXISTING entry, does not throw, does not
// re-apply the balance change) — this is what makes a retried release
// job or a duplicated webhook safe to call twice.
// ─────────────────────────────────────────────────────────────────────────

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { LedgerEntryType } from "@prisma/client";

/**
 * Which wallet bucket(s) a given entry type affects, and in which
 * direction. This table is the entire definition of how money moves —
 * read this before touching anything else in this file.
 *
 * escrow_hold:      + pendingBalance (funds captured, awaiting release)
 * commission:       - pendingBalance (platform's cut, removed before release)
 * subscription_fee: - pendingBalance (seller's subscription due, removed before release)
 * release:          - pendingBalance, + availableBalance (net amount becomes withdrawable)
 * refund:           - pendingBalance (funds returned to buyer, reversing a hold that never released)
 * payout:           - availableBalance (Phase 8 — money actually sent to seller's bank)
 * adjustment:       + or - availableBalance (manual admin correction; sign comes from `amount`)
 */
function applyToWallet(
  wallet: { pendingBalance: Prisma.Decimal; availableBalance: Prisma.Decimal; heldBalance: Prisma.Decimal },
  entryType: LedgerEntryType,
  amount: Prisma.Decimal
) {
  const abs = amount.abs();
  switch (entryType) {
    case "escrow_hold":
      return { pendingBalance: wallet.pendingBalance.add(abs), availableBalance: wallet.availableBalance, heldBalance: wallet.heldBalance };
    case "commission":
    case "subscription_fee":
      return { pendingBalance: wallet.pendingBalance.sub(abs), availableBalance: wallet.availableBalance, heldBalance: wallet.heldBalance };
    case "release":
      return { pendingBalance: wallet.pendingBalance.sub(abs), availableBalance: wallet.availableBalance.add(amount), heldBalance: wallet.heldBalance };
    case "refund":
      return { pendingBalance: wallet.pendingBalance.sub(abs), availableBalance: wallet.availableBalance, heldBalance: wallet.heldBalance };
    case "payout":
      return { pendingBalance: wallet.pendingBalance, availableBalance: wallet.availableBalance.sub(abs), heldBalance: wallet.heldBalance };
    case "adjustment":
      return { pendingBalance: wallet.pendingBalance, availableBalance: wallet.availableBalance.add(amount), heldBalance: wallet.heldBalance };
  }
}

export interface PostLedgerEntryParams {
  sellerId: string;
  orderItemId?: string | null;
  entryType: LedgerEntryType;
  /** Positive for credits, negative for debits — see applyToWallet() above for the exact effect per type. */
  amount: number;
  idempotencyKey: string;
  note?: string;
}

type TxOrClient = Prisma.TransactionClient | typeof prisma;

/**
 * Posts one ledger entry and updates the seller's wallet, atomically.
 *
 * IMPORTANT: accepts an optional `tx` (a Prisma transaction client). When
 * a caller needs to post MULTIPLE ledger entries as one atomic operation
 * (e.g. releaseOneHold() in escrow.service.ts posts commission +
 * subscription_fee + release together), it must open ONE
 * `prisma.$transaction(async (tx) => {...})` itself and pass that same
 * `tx` into every postLedgerEntry() call inside it. Prisma does not
 * support nested transactions — calling this function's own internal
 * `prisma.$transaction` from inside another transaction's callback would
 * silently create a SEPARATE, non-atomic transaction instead of joining
 * the outer one, which would break the exact atomicity guarantee this
 * whole ledger system exists to provide. If no `tx` is passed, this
 * function opens its own transaction — correct for single-entry callers
 * like createEscrowHoldsForOrder()'s per-item loop, where each entry is
 * independently atomic by design.
 *
 * Returns the ledger entry — either the one just created, or (if
 * idempotencyKey was already used) the pre-existing one, unchanged, with
 * no balance side-effect the second time.
 */
export async function postLedgerEntry(params: PostLedgerEntryParams, tx?: Prisma.TransactionClient) {
  const run = async (client: TxOrClient) => {
    const existing = await client.ledgerEntry.findUnique({
      where: { idempotencyKey: params.idempotencyKey },
    });
    if (existing) {
      // Already posted — idempotent no-op. This is the exact mechanism
      // that makes a retried release job safe (see Phase 7 acceptance
      // criteria: "re-running the release job ... is a no-op").
      return existing;
    }

    // Wallet must exist before any entry can post against it — sellers
    // get one automatically the moment they're approved (see
    // wallet.service.ts createWalletForSeller(), called from the same
    // approval branch that creates their Store and trial subscription).
    const wallet = await client.wallet.findUnique({ where: { sellerId: params.sellerId } });
    if (!wallet) {
      throw new Error(
        `No wallet exists for seller ${params.sellerId} — this should never happen for an active seller. Check createWalletForSeller() is wired into the approval flow.`
      );
    }

    const amountDecimal = new Prisma.Decimal(params.amount);
    const next = applyToWallet(wallet, params.entryType, amountDecimal);

    const updatedWallet = await client.wallet.update({
      where: { sellerId: params.sellerId },
      data: next,
    });

    const entry = await client.ledgerEntry.create({
      data: {
        sellerId: params.sellerId,
        orderItemId: params.orderItemId ?? null,
        entryType: params.entryType,
        amount: amountDecimal,
        balanceAfter: updatedWallet.availableBalance,
        idempotencyKey: params.idempotencyKey,
        note: params.note,
      },
    });

    return entry;
  };

  if (tx) return run(tx);
  return prisma.$transaction((freshTx) => run(freshTx));
}

export async function getWalletForSeller(sellerId: string) {
  return prisma.wallet.findUnique({ where: { sellerId } });
}

export async function getLedgerHistoryForSeller(
  sellerId: string,
  params: { page?: number; pageSize?: number } = {}
) {
  const { page = 1, pageSize = 20 } = params;
  const [items, total] = await Promise.all([
    prisma.ledgerEntry.findMany({
      where: { sellerId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.ledgerEntry.count({ where: { sellerId } }),
  ]);
  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

/**
 * Phase 7's acceptance criteria as a runnable check: "Wallet balances
 * reconcile exactly against the sum of that seller's ledger entries."
 * Not wired into any UI — intended to be called from a script or test
 * suite before trusting this system with real money, exactly as the
 * doc's own Risk note recommends.
 */
export async function verifyWalletReconciliation(sellerId: string): Promise<{
  reconciled: boolean;
  walletAvailable: number;
  ledgerSum: number;
}> {
  const wallet = await prisma.wallet.findUnique({ where: { sellerId } });
  if (!wallet) return { reconciled: false, walletAvailable: 0, ledgerSum: 0 };

  const entries = await prisma.ledgerEntry.findMany({ where: { sellerId } });

  // Sum only the entries whose effect lands in availableBalance — release,
  // payout (negative), and adjustment. escrow_hold/commission/
  // subscription_fee/refund only ever move pendingBalance, never
  // availableBalance, so they're correctly excluded from this specific sum.
  let sum = new Prisma.Decimal(0);
  for (const e of entries) {
    if (e.entryType === "release" || e.entryType === "adjustment") sum = sum.add(e.amount);
    if (e.entryType === "payout") sum = sum.sub(e.amount.abs());
  }

  const walletAvailable = Number(wallet.availableBalance);
  const ledgerSum = Number(sum);

  return { reconciled: walletAvailable === ledgerSum, walletAvailable, ledgerSum };
}
