-- Phase 8: Payout Management & Banking Integration
-- Additive only. Assumes Phase 7 (wallets, ledger_entries, escrow_holds,
-- commissions_config, marketplace_settings) is ALREADY applied.

-- ── New enum ──────────────────────────────────────────────────────────────
CREATE TYPE "PayoutStatus" AS ENUM (
  'requested',
  'processing',
  'paid',
  'failed',
  'cancelled'
);

-- ── seller_bank_accounts ─────────────────────────────────────────────────
-- accountNumber/routingCode are stored ENCRYPTED at the application layer
-- (see lib/security/field-encryption.ts) — the column itself is just TEXT,
-- since Postgres doesn't need to know the contents are ciphertext.
CREATE TABLE "seller_bank_accounts" (
    "id"                TEXT NOT NULL,
    "sellerId"          TEXT NOT NULL,
    "accountHolderName" TEXT NOT NULL,
    "bankName"          TEXT NOT NULL,
    "accountNumber"     TEXT NOT NULL,
    "routingCode"       TEXT,
    "accountType"       TEXT NOT NULL DEFAULT 'current',
    "isVerified"        BOOLEAN NOT NULL DEFAULT false,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seller_bank_accounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "seller_bank_accounts_sellerId_key"
  ON "seller_bank_accounts"("sellerId");

ALTER TABLE "seller_bank_accounts"
  ADD CONSTRAINT "seller_bank_accounts_sellerId_fkey"
  FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── payout_requests ───────────────────────────────────────────────────────
CREATE TABLE "payout_requests" (
    "id"                    TEXT NOT NULL,
    "sellerId"              TEXT NOT NULL,
    "amount"                DECIMAL(12,2) NOT NULL,
    "currency"              CHAR(3) NOT NULL DEFAULT 'PKR',
    "status"                "PayoutStatus" NOT NULL DEFAULT 'requested',
    "bankAccountSnapshot"   JSONB NOT NULL,
    "processedBy"           TEXT,
    "processedAt"           TIMESTAMP(3),
    "adminNote"             TEXT,
    "ledgerEntryId"         TEXT,
    "requestedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"             TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payout_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payout_requests_ledgerEntryId_key"
  ON "payout_requests"("ledgerEntryId");

CREATE INDEX "payout_requests_sellerId_idx"
  ON "payout_requests"("sellerId");
CREATE INDEX "payout_requests_status_idx"
  ON "payout_requests"("status");
CREATE INDEX "payout_requests_sellerId_status_idx"
  ON "payout_requests"("sellerId", "status");

ALTER TABLE "payout_requests"
  ADD CONSTRAINT "payout_requests_sellerId_fkey"
  FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ledgerEntryId DOES get a real FK constraint, unlike an earlier draft of
-- this migration assumed was impossible — a nullable column can have a
-- normal FK constraint in Postgres (NULL or a valid match are both
-- accepted). This guarantees ledgerEntryId can never point at a row that
-- doesn't exist, in addition to the unique index preventing two payouts
-- from ever sharing one ledger entry.
ALTER TABLE "payout_requests"
  ADD CONSTRAINT "payout_requests_ledgerEntryId_fkey"
  FOREIGN KEY ("ledgerEntryId") REFERENCES "ledger_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── marketplace_settings: auto-payout toggle, off by default ────────────
ALTER TABLE "marketplace_settings"
  ADD COLUMN IF NOT EXISTS "autoPayoutEnabled" BOOLEAN NOT NULL DEFAULT false;
