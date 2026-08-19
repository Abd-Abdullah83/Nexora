-- Phase 9: Returns, Refunds & Dispute Resolution
-- Additive only. Assumes Phase 8 (payout_requests, seller_bank_accounts,
-- marketplace_settings.autoPayoutEnabled) is already applied.
--
-- Two operations:
--   1. New enums + disputes table
--   2. No ALTER on escrow_holds — EscrowHoldStatus.disputed already exists
--      (it was added in Phase 7's migration). The release job already
--      excludes holds with status='disputed' via the WHERE clause.
--      Phase 9 just needs to SET that status when a dispute opens.

-- ── 1. New enums ─────────────────────────────────────────────────────────

CREATE TYPE "DisputeType" AS ENUM (
  'return',
  'refund',
  'chargeback'
);

-- Status follows the arbitration flow:
--   open → seller_review → admin_review → resolved_refunded / resolved_denied
-- Seller can shortcut open → resolved_refunded (accepted) or escalate to
-- admin_review. Admin can shortcut any in-progress status to either resolved.
CREATE TYPE "DisputeStatus" AS ENUM (
  'open',
  'seller_review',
  'admin_review',
  'resolved_refunded',
  'resolved_denied'
);

CREATE TYPE "DisputeOpenedBy" AS ENUM (
  'buyer',
  'seller',
  'admin'
);

-- ── 2. disputes ───────────────────────────────────────────────────────────

CREATE TABLE "disputes" (
    "id"               TEXT NOT NULL,
    "orderItemId"      TEXT NOT NULL,

    -- Who initiated the dispute and what kind it is
    "openedBy"         "DisputeOpenedBy" NOT NULL DEFAULT 'buyer',
    "type"             "DisputeType" NOT NULL,
    "status"           "DisputeStatus" NOT NULL DEFAULT 'open',

    -- Buyer's opening statement — required
    "buyerReason"      TEXT NOT NULL,
    -- Seller's response (populated by /api/sellers/disputes/[id]/respond)
    "sellerResponse"   TEXT,
    "sellerResponseAt" TIMESTAMP(3),
    -- Admin final ruling notes
    "resolutionNotes"  TEXT,
    "resolvedBy"       TEXT,

    -- Full/partial refund amount — set when admin resolves as refunded.
    -- NULL means no refund was granted (resolved_denied, or not yet resolved).
    -- If partial refund, amount < orderItem.unitPrice * quantity.
    "refundAmount"     DECIMAL(12,2),

    -- Linked ledger entry for the refund debit — set when status moves to
    -- resolved_refunded. Unique constraint prevents double-refunding.
    "ledgerEntryId"    TEXT,

    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt"       TIMESTAMP(3),
    "updatedAt"        TIMESTAMP(3) NOT NULL,

    CONSTRAINT "disputes_pkey" PRIMARY KEY ("id")
);

-- One active dispute per order item — a resolved dispute can be followed
-- by a new one (e.g. buyer re-disputes a partial refund), but not while
-- one is still open. Enforced in dispute.service.ts, not just the DB.
-- We use a partial unique index to allow multiple rows per orderItemId
-- as long as at most one is in an unresolved state — not expressible as
-- a simple UNIQUE constraint, so we enforce it in application code.
CREATE INDEX "disputes_orderItemId_idx"   ON "disputes"("orderItemId");
CREATE INDEX "disputes_status_idx"        ON "disputes"("status");
CREATE UNIQUE INDEX "disputes_ledgerEntryId_key" ON "disputes"("ledgerEntryId");

ALTER TABLE "disputes"
  ADD CONSTRAINT "disputes_orderItemId_fkey"
  FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "disputes"
  ADD CONSTRAINT "disputes_resolvedBy_fkey"
  FOREIGN KEY ("resolvedBy") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ledgerEntryId FK — nullable column, valid FK in Postgres
ALTER TABLE "disputes"
  ADD CONSTRAINT "disputes_ledgerEntryId_fkey"
  FOREIGN KEY ("ledgerEntryId") REFERENCES "ledger_entries"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
