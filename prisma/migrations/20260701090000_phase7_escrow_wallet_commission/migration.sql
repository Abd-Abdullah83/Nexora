-- Phase 7: Escrow, Wallet & Commission Engine
-- Additive only. Assumes Phase 6 (order_items.sellerId,
-- OrderItemFulfillmentStatus, etc.) is ALREADY applied to your database —
-- this migration does not touch order_items at all beyond adding two
-- back-relations (which Prisma needs no DDL for; relations are virtual).

-- ── New enums ────────────────────────────────────────────────────────────
CREATE TYPE "LedgerEntryType" AS ENUM (
  'escrow_hold', 'commission', 'subscription_fee', 'release', 'refund', 'payout', 'adjustment'
);
CREATE TYPE "EscrowHoldStatus" AS ENUM ('held', 'released', 'frozen', 'disputed');

-- ── wallets ──────────────────────────────────────────────────────────────
CREATE TABLE "wallets" (
    "id"               TEXT NOT NULL,
    "sellerId"         TEXT NOT NULL,
    "pendingBalance"   DECIMAL(12,2) NOT NULL DEFAULT 0,
    "availableBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "heldBalance"      DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency"         CHAR(3) NOT NULL DEFAULT 'PKR',
    "updatedAt"        TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "wallets_sellerId_key" ON "wallets"("sellerId");

ALTER TABLE "wallets" ADD CONSTRAINT "wallets_sellerId_fkey"
    FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── ledger_entries ───────────────────────────────────────────────────────
CREATE TABLE "ledger_entries" (
    "id"             TEXT NOT NULL,
    "sellerId"       TEXT NOT NULL,
    "orderItemId"    TEXT,
    "entryType"      "LedgerEntryType" NOT NULL,
    "amount"         DECIMAL(12,2) NOT NULL,
    "balanceAfter"   DECIMAL(12,2) NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "note"           TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ledger_entries_idempotencyKey_key" ON "ledger_entries"("idempotencyKey");
CREATE INDEX "ledger_entries_sellerId_idx" ON "ledger_entries"("sellerId");
CREATE INDEX "ledger_entries_orderItemId_idx" ON "ledger_entries"("orderItemId");
CREATE INDEX "ledger_entries_sellerId_createdAt_idx" ON "ledger_entries"("sellerId", "createdAt");

ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_sellerId_fkey"
    FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_orderItemId_fkey"
    FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── escrow_holds ─────────────────────────────────────────────────────────
CREATE TABLE "escrow_holds" (
    "id"                TEXT NOT NULL,
    "orderItemId"       TEXT NOT NULL,
    "sellerId"          TEXT NOT NULL,
    "status"            "EscrowHoldStatus" NOT NULL DEFAULT 'held',
    "grossAmount"       DECIMAL(12,2) NOT NULL,
    "deliveredAt"       TIMESTAMP(3),
    "releaseEligibleAt" TIMESTAMP(3),
    "releasedAt"        TIMESTAMP(3),
    "frozenAt"          TIMESTAMP(3),
    "frozenBy"          TEXT,
    "freezeReason"      TEXT,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL,

    CONSTRAINT "escrow_holds_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "escrow_holds_orderItemId_key" ON "escrow_holds"("orderItemId");
CREATE INDEX "escrow_holds_sellerId_idx" ON "escrow_holds"("sellerId");
CREATE INDEX "escrow_holds_status_idx" ON "escrow_holds"("status");
CREATE INDEX "escrow_holds_status_releaseEligibleAt_idx" ON "escrow_holds"("status", "releaseEligibleAt");

ALTER TABLE "escrow_holds" ADD CONSTRAINT "escrow_holds_orderItemId_fkey"
    FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "escrow_holds" ADD CONSTRAINT "escrow_holds_sellerId_fkey"
    FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── commissions_config ───────────────────────────────────────────────────
CREATE TABLE "commissions_config" (
    "id"            TEXT NOT NULL,
    "sellerType"    "SellerType" NOT NULL,
    "ratePercent"   DECIMAL(5,2) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo"   TIMESTAMP(3),
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commissions_config_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "commissions_config_sellerType_effectiveFrom_idx"
  ON "commissions_config"("sellerType", "effectiveFrom");

-- Seed the two initial rates from the scaling doc: 2.5% Individual, 2.3% Business.
-- effectiveTo is left NULL (open-ended) — this is the rate in effect from
-- today onward, until a future admin action ends it and inserts a new row.
-- IDs generated with md5(random()::text) rather than gen_random_uuid() —
-- the latter requires the pgcrypto extension, which isn't confirmed
-- installed on this database; this needs no extension and is still
-- collision-safe for two seed rows.
INSERT INTO "commissions_config" ("id", "sellerType", "ratePercent", "effectiveFrom")
VALUES
  (md5(random()::text || clock_timestamp()::text), 'individual', 2.5, CURRENT_TIMESTAMP),
  (md5(random()::text || clock_timestamp()::text), 'business',   2.3, CURRENT_TIMESTAMP);

-- ── Backfill wallets for every seller who already has an active store ────
-- (so getSellerWallet() never has to special-case "wallet doesn't exist
-- yet" for sellers approved before this migration ran)
INSERT INTO "wallets" ("id", "sellerId", "pendingBalance", "availableBalance", "heldBalance", "currency", "updatedAt")
SELECT md5(random()::text || clock_timestamp()::text || "id"), "id", 0, 0, 0, 'PKR', CURRENT_TIMESTAMP
FROM "sellers"
WHERE "status" = 'active';
