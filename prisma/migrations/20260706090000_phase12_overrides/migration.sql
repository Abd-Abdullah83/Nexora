-- Phase 12: Marketplace-Wide Admin Console Upgrade & Hardening Pass
-- Additive only. Assumes Phase 11 is applied.
--
-- 1. admin_overrides — immutable log of every manual admin intervention
-- 2. Missing indexes identified during OWASP review (items 9-10 below)

-- ── 1. OverrideResourceType enum ─────────────────────────────────────────
CREATE TYPE "OverrideResourceType" AS ENUM (
  'order',
  'escrow_hold',
  'listing'
);

CREATE TYPE "OverrideAction" AS ENUM (
  -- Order actions
  'order_force_complete',
  'order_force_cancel',
  -- Escrow actions
  'escrow_manual_release',
  'escrow_manual_unfreeze',
  -- Listing actions
  'listing_force_archive',
  'listing_force_reactivate'
);

-- ── 2. admin_overrides ────────────────────────────────────────────────────
-- Immutable after INSERT. Every manual admin intervention that bypasses
-- the normal automated flow must create a row here. The overrides page
-- (/admin/overrides) queries this table directly.
CREATE TABLE "admin_overrides" (
    "id"           TEXT NOT NULL,
    "adminId"      TEXT NOT NULL,
    "resourceType" "OverrideResourceType" NOT NULL,
    "resourceId"   TEXT NOT NULL,
    "action"       "OverrideAction" NOT NULL,
    "reason"       TEXT NOT NULL,
    "beforeState"  JSONB,         -- snapshot of resource before override
    "afterState"   JSONB,         -- snapshot of resource after override
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_overrides_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "admin_overrides_adminId_idx"      ON "admin_overrides"("adminId");
CREATE INDEX "admin_overrides_resourceId_idx"   ON "admin_overrides"("resourceId");
CREATE INDEX "admin_overrides_resourceType_idx" ON "admin_overrides"("resourceType");
CREATE INDEX "admin_overrides_createdAt_idx"    ON "admin_overrides"("createdAt" DESC);

ALTER TABLE "admin_overrides"
  ADD CONSTRAINT "admin_overrides_adminId_fkey"
  FOREIGN KEY ("adminId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── 3. Missing indexes from OWASP load-test review ───────────────────────
-- These were identified by reviewing slow-query candidates across the
-- new multi-tenant surface added in Phases 1-11. All additive.

-- seller_id on products — every seller-scoped listing query filters on this
CREATE INDEX IF NOT EXISTS "products_sellerId_idx"
  ON "products"("sellerId") WHERE "deletedAt" IS NULL;

-- seller_id + status on payout_requests — payout queue + dispute check
CREATE INDEX IF NOT EXISTS "payout_requests_sellerId_status_idx"
  ON "payout_requests"("sellerId", "status");

-- seller_id + status on escrow_holds — release job + dispute block check
CREATE INDEX IF NOT EXISTS "escrow_holds_sellerId_status_idx"
  ON "escrow_holds"("sellerId", "status");

-- action + createdAt on audit_logs — audit log viewer filters by action domain
CREATE INDEX IF NOT EXISTS "audit_logs_action_createdAt_idx"
  ON "audit_logs"("action", "createdAt" DESC);

-- status + createdAt on disputes — admin queue ordered by oldest first
CREATE INDEX IF NOT EXISTS "disputes_status_createdAt_idx"
  ON "disputes"("status", "createdAt" ASC);
