-- Phase 11 (First Half): Identity Duplicate Detection & Ban-Evasion Prevention
-- Additive only. Assumes Phase 10 is applied.
--
-- What this adds:
--   1. Three new columns on sellers (bannedAt, bannedBy, banReason,
--      suspendedUntil)
--   2. BanAction enum + seller_ban_records table (immutable enforcement log)
--   3. BanEvasionAlertStatus enum + ban_evasion_alerts table (duplicate
--      detection results awaiting admin review)
--
-- What it does NOT touch:
--   - SellerStatus enum — "banned" and "suspended" already exist since
--     Phase 1. No ALTER ENUM needed.
--   - seller_identity_hashes — built in Phase 3, no changes.

-- ── 1. New columns on sellers ─────────────────────────────────────────────
ALTER TABLE "sellers"
  ADD COLUMN IF NOT EXISTS "bannedAt"       TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "bannedBy"       TEXT,
  ADD COLUMN IF NOT EXISTS "banReason"      TEXT,
  ADD COLUMN IF NOT EXISTS "suspendedUntil" TIMESTAMP(3);

-- ── 2. BanAction enum ─────────────────────────────────────────────────────
CREATE TYPE "BanAction" AS ENUM ('banned', 'suspended', 'reinstated');

-- ── 3. seller_ban_records ─────────────────────────────────────────────────
-- Immutable after INSERT — never UPDATE. The history is the record.
-- triggeredByHashIds is JSONB containing an array of SellerIdentityHash.id
-- strings that caused this action (empty array = manual admin action).
CREATE TABLE "seller_ban_records" (
    "id"                   TEXT NOT NULL,
    "sellerId"             TEXT NOT NULL,
    "action"               "BanAction" NOT NULL,
    "reason"               TEXT NOT NULL,
    "adminId"              TEXT NOT NULL,
    "triggeredByHashIds"   JSONB NOT NULL DEFAULT '[]',
    "suspendedUntil"       TIMESTAMP(3),
    "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seller_ban_records_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "seller_ban_records_sellerId_idx"
  ON "seller_ban_records"("sellerId");

CREATE INDEX "seller_ban_records_sellerId_action_idx"
  ON "seller_ban_records"("sellerId", "action");

ALTER TABLE "seller_ban_records"
  ADD CONSTRAINT "seller_ban_records_sellerId_fkey"
  FOREIGN KEY ("sellerId") REFERENCES "sellers"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "seller_ban_records"
  ADD CONSTRAINT "seller_ban_records_adminId_fkey"
  FOREIGN KEY ("adminId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── 4. BanEvasionAlertStatus enum ────────────────────────────────────────
CREATE TYPE "BanEvasionAlertStatus" AS ENUM (
  'pending',
  'approved',
  'ban_confirmed'
);

-- ── 5. ban_evasion_alerts ─────────────────────────────────────────────────
-- Created by ban-evasion.service.ts when a new seller's identity hashes
-- match a banned seller's. Awaits admin review — the alert itself does NOT
-- block activation; it surfaces the match so a human can decide.
-- matchedSellerId has no FK intentionally — see schema.prisma comment.
CREATE TABLE "ban_evasion_alerts" (
    "id"                  TEXT NOT NULL,
    "newSellerId"         TEXT NOT NULL,
    "matchedSellerId"     TEXT NOT NULL,
    "matchedIdentityType" "IdentityType" NOT NULL,
    "matchedHashId"       TEXT NOT NULL,
    "status"              "BanEvasionAlertStatus" NOT NULL DEFAULT 'pending',
    "resolvedBy"          TEXT,
    "resolvedAt"          TIMESTAMP(3),
    "adminNote"           TEXT,
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ban_evasion_alerts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ban_evasion_alerts_newSellerId_idx"
  ON "ban_evasion_alerts"("newSellerId");

CREATE INDEX "ban_evasion_alerts_status_idx"
  ON "ban_evasion_alerts"("status");

ALTER TABLE "ban_evasion_alerts"
  ADD CONSTRAINT "ban_evasion_alerts_newSellerId_fkey"
  FOREIGN KEY ("newSellerId") REFERENCES "sellers"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
