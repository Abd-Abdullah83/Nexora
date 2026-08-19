// ─────────────────────────────────────────────────────────────────────────
// lib/wallet/payout.service.ts
//
// Phase 8 — Payout system.
//
// ── Encryption at rest ───────────────────────────────────────────────────
// accountNumber and routingCode are encrypted via lib/security/
// field-encryption.ts (AES-256-GCM) before ever reaching the database,
// and decrypted only at the one place that needs the real value: the
// admin verify-bank-account action, where a human confirms a test
// payout reached the right account. Every other read path
// (getSellerBankAccount, payout snapshots, admin queue listings) only
// ever sees the MASKED value — see maskBankAccount() below.
//
// ── Ledger integration ────────────────────────────────────────────────────
// postLedgerEntry("payout") is the ONE call that deducts from
// availableBalance. It is posted ONLY when an admin marks a payout as
// "paid" — not on request, not on "processing". This keeps the balance
// figure accurate at every stage: a requested-but-not-yet-paid payout
// has not left the seller's balance yet, because it literally hasn't.
// Cancellation and failure therefore need no compensating ledger entry
// because nothing was ever deducted.
//
// ── One active payout at a time ──────────────────────────────────────────
// A seller may not have two payouts in "requested" or "processing" at the
// same time. Reason: the amount isn't reserved from availableBalance at
// request time (by design — see above), so two simultaneous requests
// could each pass the balance-check independently and together exceed
// what's actually available. Banning concurrent in-flight payouts avoids
// this without the complexity of a reservation/hold system.
//
// ── Phase 9 note ─────────────────────────────────────────────────────────
// Phase 7's escrow service left a "disputed" EscrowHoldStatus on
// EscrowHold and a note that the release job must check for open disputes.
// The same principle applies here: before marking a payout as paid, this
// function should (once Phase 9 ships) also check for open disputes. The
// comment in markPayoutPaid() below is the marker for that change.
// ─────────────────────────────────────────────────────────────────────────

import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors";
import { logAuditEvent } from "@/lib/audit";
import { postLedgerEntry, getWalletForSeller } from "@/lib/wallet/ledger.service";
import { encryptField, decryptField } from "@/lib/security/field-encryption";
import { createNotification } from "@/lib/notifications/notifications.service";
import type { BankAccountInput, PayoutRequestInput } from "@/lib/validation/payout";
import { MIN_PAYOUT_AMOUNT } from "@/lib/validation/payout";


// ─────────────────────────────────────────────────────────────────────────
// Bank account management
// ─────────────────────────────────────────────────────────────────────────

/**
 * Returns MASKED bank account data — never the full account number.
 * Safe to return to any authenticated seller or admin response.
 */
function maskBankAccount(account: {
  id: string;
  accountHolderName: string;
  bankName: string;
  accountNumber: string;
  routingCode: string | null;
  accountType: string;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  const n = account.accountNumber;
  const masked = n.length > 4 ? `${"*".repeat(n.length - 4)}${n.slice(-4)}` : "****";
  return {
    ...account,
    accountNumber: masked,
  };
}

export async function getSellerBankAccount(sellerId: string) {
  const account = await prisma.sellerBankAccount.findUnique({ where: { sellerId } });
  if (!account) return null;
  // Decrypt to get the real value, then immediately re-mask for the response.
  // This is the correct pattern for the masked read path: decrypt in memory,
  // mask, return mask. The decrypted value never leaves this function.
  const decrypted = {
    ...account,
    accountNumber: decryptField(account.accountNumber),
    routingCode: account.routingCode ? decryptField(account.routingCode) : account.routingCode,
  };
  return maskBankAccount(decrypted);
}

/**
 * Returns the FULL decrypted bank account — only for admin use when
 * confirming a test payout reached the correct account. Never call this
 * from a seller-facing route.
 */
export async function getDecryptedBankAccountForAdmin(sellerId: string) {
  const account = await prisma.sellerBankAccount.findUnique({ where: { sellerId } });
  if (!account) return null;
  return {
    ...account,
    accountNumber: decryptField(account.accountNumber),
    routingCode: account.routingCode ? decryptField(account.routingCode) : account.routingCode,
  };
}

export async function saveSellerBankAccount(sellerId: string, actorUserId: string, data: BankAccountInput) {
  // Upsert — one bank account per seller at all times. Changing the
  // account resets isVerified to false (the new account isn't verified
  // yet — an admin needs to confirm a test payout reached it).
  const existing = await prisma.sellerBankAccount.findUnique({ where: { sellerId } });

  // Encrypt sensitive fields before they reach the database.
  // field-encryption.ts uses AES-256-GCM — each call produces a unique
  // ciphertext even for the same plaintext (fresh IV per call), so
  // encrypting the same account number twice produces different stored
  // values. That's correct, not a bug.
  const encryptedData = {
    ...data,
    accountNumber: encryptField(data.accountNumber),
    routingCode: data.routingCode ? encryptField(data.routingCode) : data.routingCode,
  };

  const account = await prisma.sellerBankAccount.upsert({
    where: { sellerId },
    create: { sellerId, ...encryptedData, isVerified: false },
    update: {
      ...encryptedData,
      isVerified: false, // Always reset on change — a different account needs re-verification
    },
  });

  await logAuditEvent({
    userId: actorUserId,
    action: existing ? "seller.bank_account_updated" : "seller.bank_account_saved",
    resourceType: "seller_bank_account",
    resourceId: account.id,
    ipAddress: "internal",
    // Never log the full account number — mask in the audit trail too.
    // Note: account.accountNumber here is already the ENCRYPTED ciphertext,
    // so slicing -4 gives ciphertext chars, not the real last-4. We pass
    // the plaintext last-4 from `data` directly (pre-encryption) instead.
    newValues: { bankName: data.bankName, accountType: data.accountType, last4: data.accountNumber.slice(-4) },
  });

  // Return the masked view — never the ciphertext or plaintext.
  return maskBankAccount({ ...account, accountNumber: data.accountNumber });
}

// ─────────────────────────────────────────────────────────────────────────
// Payout requests — seller actions
// ─────────────────────────────────────────────────────────────────────────

export async function requestPayout(
  sellerId: string,
  actorUserId: string,
  data: PayoutRequestInput
) {
  // 1. Bank account must exist
  const bankAccount = await prisma.sellerBankAccount.findUnique({ where: { sellerId } });
  if (!bankAccount) {
    throw new AppError("VALIDATION_ERROR", {
      bankAccount: "You must add a bank account before requesting a payout.",
    });
  }

  // 2. Only one active payout at a time
  const existing = await prisma.payoutRequest.findFirst({
    where: { sellerId, status: { in: ["requested", "processing"] } },
  });
  if (existing) {
    throw new AppError("VALIDATION_ERROR", {
      status: "You already have a payout in progress. Wait for it to complete before requesting another.",
    });
  }

  // 3. Available balance check
  const wallet = await getWalletForSeller(sellerId);
  const available = wallet ? Number(wallet.availableBalance) : 0;
  if (data.amount > available) {
    throw new AppError("VALIDATION_ERROR", {
      amount: `Requested amount (PKR ${data.amount.toFixed(2)}) exceeds your available balance (PKR ${available.toFixed(2)}).`,
    });
  }

  // 4. Minimum check (belt-and-suspenders — Zod already validates, but
  //    validate again here since this is a financial operation)
  if (data.amount < MIN_PAYOUT_AMOUNT) {
    throw new AppError("VALIDATION_ERROR", {
      amount: `Minimum payout is PKR ${MIN_PAYOUT_AMOUNT}.`,
    });
  }

  // 5. Block payout if seller has any open disputed escrow holds.
  //    A dispute may result in a refund — the disputed amount is not
  //    safely theirs yet. Check against EscrowHold.status = "disputed"
  //    which is set by dispute.service.ts's openDispute().
  const openDisputeCount = await prisma.escrowHold.count({
    where: { sellerId, status: "disputed" },
  });
  if (openDisputeCount > 0) {
    throw new AppError("VALIDATION_ERROR", {
      disputes: `You have ${openDisputeCount} open dispute${openDisputeCount > 1 ? "s" : ""}. Resolve all disputes before requesting a payout.`,
    });
  }

  // 6. Create the payout request. Snapshot the bank account (masked) now
  //    so a later account change doesn't alter this record.
  const snapshot = {
    accountHolderName: bankAccount.accountHolderName,
    bankName: bankAccount.bankName,
    accountNumberMasked: (() => {
     const n = decryptField(bankAccount.accountNumber);
return n.length > 4 ? `${"*".repeat(n.length - 4)}${n.slice(-4)}` : "****";
    })(),
    routingCode: bankAccount.routingCode,
    accountType: bankAccount.accountType,
    isVerified: bankAccount.isVerified,
  };

  const payout = await prisma.payoutRequest.create({
    data: {
      sellerId,
      amount: data.amount,
      currency: data.currency,
      bankAccountSnapshot: snapshot,
    },
  });

  await logAuditEvent({
    userId: actorUserId,
    action: "seller.payout_requested",
    resourceType: "payout_request",
    resourceId: payout.id,
    ipAddress: "internal",
    newValues: { amount: data.amount, currency: data.currency },
  });

  return payout;
}

export async function cancelPayoutRequest(
  payoutId: string,
  sellerId: string,
  actorUserId: string
) {
  const payout = await prisma.payoutRequest.findFirst({
    where: { id: payoutId, sellerId },
  });
  if (!payout) throw new AppError("VALIDATION_ERROR", { id: "Payout request not found." });

  if (payout.status !== "requested") {
    throw new AppError("VALIDATION_ERROR", {
      status: `Cannot cancel a payout that is already "${payout.status}". Contact support.`,
    });
  }

  const updated = await prisma.payoutRequest.update({
    where: { id: payoutId },
    data: { status: "cancelled", updatedAt: new Date() },
  });

  await logAuditEvent({
    userId: actorUserId,
    action: "seller.payout_cancelled",
    resourceType: "payout_request",
    resourceId: payoutId,
    ipAddress: "internal",
  });

  return updated;
}

export async function getPayoutHistory(
  sellerId: string,
  params: { page?: number; pageSize?: number } = {}
) {
  const { page = 1, pageSize = 20 } = params;
  const [items, total] = await Promise.all([
    prisma.payoutRequest.findMany({
      where: { sellerId },
      orderBy: { requestedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.payoutRequest.count({ where: { sellerId } }),
  ]);
  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

// ─────────────────────────────────────────────────────────────────────────
// Admin actions
// ─────────────────────────────────────────────────────────────────────────

export async function getPayoutQueue(params: {
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  const { status, page = 1, pageSize = 25 } = params;

  // "pending" is a convenience filter that means "requested OR processing"
  const where =
    status === "pending"
      ? { status: { in: ["requested", "processing"] as const } }
      : status
      ? { status: status as any }
      : {};

  const [items, total] = await Promise.all([
    prisma.payoutRequest.findMany({
      where,
      orderBy: { requestedAt: "asc" }, // FIFO — oldest request first
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        seller: {
          select: {
            id: true,
            displayName: true,
            sellerType: true,
            businessEmail: true,
          },
        },
      },
    }),
    prisma.payoutRequest.count({ where }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function markPayoutProcessing(
  payoutId: string,
  adminUserId: string,
  adminNote?: string
) {
  const payout = await prisma.payoutRequest.findUnique({ where: { id: payoutId } });
  if (!payout) throw new AppError("VALIDATION_ERROR", { id: "Payout request not found." });
  if (payout.status !== "requested") {
    throw new AppError("VALIDATION_ERROR", {
      status: `Can only mark a "requested" payout as processing — current status is "${payout.status}".`,
    });
  }

  const updated = await prisma.payoutRequest.update({
    where: { id: payoutId },
    data: {
      status: "processing",
      processedBy: adminUserId,
      processedAt: new Date(),
      adminNote: adminNote ?? null,
    },
  });

  await logAuditEvent({
    userId: adminUserId,
    action: "admin.payout_processing",
    resourceType: "payout_request",
    resourceId: payoutId,
    ipAddress: "internal",
  });

  return updated;
}

export async function markPayoutPaid(
  payoutId: string,
  adminUserId: string,
  adminNote?: string
) {
  const payout = await prisma.payoutRequest.findUnique({ where: { id: payoutId } });
  if (!payout) throw new AppError("VALIDATION_ERROR", { id: "Payout request not found." });
  if (payout.status !== "processing") {
    throw new AppError("VALIDATION_ERROR", {
      status: `Can only mark a "processing" payout as paid — current status is "${payout.status}". Move it to processing first.`,
    });
  }
  if (payout.ledgerEntryId) {
    throw new AppError("VALIDATION_ERROR", {
      ledgerEntryId: "This payout already has a ledger entry — it may have been marked paid already.",
    });
  }

  // Phase 9: block marking paid if seller has open disputed holds.
  // Same rationale as requestPayout() — a disputed hold may still result
  // in a refund that reduces available balance after this debit posts.
  const openDisputeCount = await prisma.escrowHold.count({
    where: { sellerId: payout.sellerId, status: "disputed" },
  });
  if (openDisputeCount > 0) {
    throw new AppError("VALIDATION_ERROR", {
      disputes: `This seller has ${openDisputeCount} open dispute${openDisputeCount > 1 ? "s" : ""}. Resolve disputes before marking payout paid.`,
    });
  }

  const now = new Date();
  const idempotencyKey = `payout:${payoutId}`;

  // Post ledger entry and update payout status atomically
  await prisma.$transaction(async (tx) => {
    // Re-check available balance inside the transaction — prevents a race
    // condition where two admin tabs could both mark the same payout paid.
    const wallet = await tx.wallet.findUnique({ where: { sellerId: payout.sellerId } });
    if (!wallet) throw new Error(`No wallet for seller ${payout.sellerId}.`);
    if (Number(wallet.availableBalance) < Number(payout.amount)) {
      throw new AppError("VALIDATION_ERROR", {
        amount: "Seller's available balance is insufficient for this payout — it may have changed since the request was made.",
      });
    }

    // postLedgerEntry posts the "payout" entry and decrements availableBalance
    const ledgerEntry = await postLedgerEntry(
      {
        sellerId: payout.sellerId,
        entryType: "payout",
        amount: -Number(payout.amount), // negative = debit from availableBalance
        idempotencyKey,
        note: `Payout to ${(payout.bankAccountSnapshot as any)?.bankName ?? "bank"} — request ${payoutId}.`,
      },
      tx
    );

    await tx.payoutRequest.update({
      where: { id: payoutId },
      data: {
        status: "paid",
        processedBy: adminUserId,
        processedAt: now,
        adminNote: adminNote ?? payout.adminNote,
        ledgerEntryId: ledgerEntry.id,
      },
    });
  });

  await logAuditEvent({
    userId: adminUserId,
    action: "admin.payout_paid",
    resourceType: "payout_request",
    resourceId: payoutId,
    ipAddress: "internal",
    newValues: { amount: Number(payout.amount), currency: payout.currency },
  });
const sellerUser = await prisma.seller.findUnique({
  where: { id: payout.sellerId },
  select: { userId: true },
});

if (sellerUser) {
  await createNotification({
    userId: sellerUser.userId,
    type: "payout_paid",
    payload: {
      payoutId,
      amount: payout.amount,
      currency: payout.currency,
    },
  });
}

return prisma.payoutRequest.findUnique({
  where: { id: payoutId },
});
}
export async function markPayoutFailed(
  payoutId: string,
  adminUserId: string,
  adminNote: string
) {
  const payout = await prisma.payoutRequest.findUnique({ where: { id: payoutId } });
  if (!payout) throw new AppError("VALIDATION_ERROR", { id: "Payout request not found." });
  if (!["requested", "processing"].includes(payout.status)) {
    throw new AppError("VALIDATION_ERROR", {
      status: `Can only fail a "requested" or "processing" payout — current status is "${payout.status}".`,
    });
  }
  if (!adminNote.trim()) {
    throw new AppError("VALIDATION_ERROR", { adminNote: "A reason is required when marking a payout failed." });
  }

  // No ledger entry needed — nothing was ever deducted, so no reversal needed.
  const updated = await prisma.payoutRequest.update({
    where: { id: payoutId },
    data: {
      status: "failed",
      processedBy: adminUserId,
      processedAt: new Date(),
      adminNote,
    },
  });

  await logAuditEvent({
    userId: adminUserId,
    action: "admin.payout_failed",
    resourceType: "payout_request",
    resourceId: payoutId,
    ipAddress: "internal",
    newValues: { reason: adminNote },
  });
const sellerUser = await prisma.seller.findUnique({
  where: { id: payout.sellerId },
  select: { userId: true },
});

if (sellerUser) {
  await createNotification({
    userId: sellerUser.userId,
    type: "payout_failed",
    payload: {
      payoutId,
      reason: adminNote,
    },
  });
}

return updated;
}
export async function adminCancelPayout(
  payoutId: string,
  adminUserId: string,
  adminNote?: string
) {
  const payout = await prisma.payoutRequest.findUnique({ where: { id: payoutId } });
  if (!payout) throw new AppError("VALIDATION_ERROR", { id: "Payout request not found." });
  if (payout.status !== "requested") {
    throw new AppError("VALIDATION_ERROR", {
      status: `Only "requested" payouts can be admin-cancelled — current status is "${payout.status}".`,
    });
  }

  const updated = await prisma.payoutRequest.update({
    where: { id: payoutId },
    data: {
      status: "cancelled",
      processedBy: adminUserId,
      processedAt: new Date(),
      adminNote: adminNote ?? null,
    },
  });

  await logAuditEvent({
    userId: adminUserId,
    action: "admin.payout_admin_cancelled",
    resourceType: "payout_request",
    resourceId: payoutId,
    ipAddress: "internal",
    newValues: { reason: adminNote },
  });

  return updated;
}
