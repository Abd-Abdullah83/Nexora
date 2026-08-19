-- Phase 5 gap fill: Listing Moderation
-- Additive only. Split into two logical blocks in one file since none of
-- these statements use a freshly-added enum value within the same
-- transaction that adds it (the ModerationStatus enum is only CREATEd
-- here, never referenced by a DEFAULT/INSERT/UPDATE in this same file).

-- ── 1. Category-level review requirement ─────────────────────────────────
-- Admin can flag an entire category (e.g. health claims, electronics
-- safety) as requiring manual review before any listing in it goes active.
ALTER TABLE "categories" ADD COLUMN "requiresManualReview" BOOLEAN NOT NULL DEFAULT false;

-- ── 2. Moderation status enum + flags table ──────────────────────────────
CREATE TYPE "ModerationFlagStatus" AS ENUM ('pending', 'cleared', 'rejected');
CREATE TYPE "ModerationRaisedBy" AS ENUM ('system', 'admin');

CREATE TABLE "listing_moderation_flags" (
    "id"          TEXT NOT NULL,
    "productId"   TEXT NOT NULL,
    "reason"      TEXT NOT NULL,
    "status"      "ModerationFlagStatus" NOT NULL DEFAULT 'pending',
    "raisedBy"    "ModerationRaisedBy" NOT NULL DEFAULT 'system',
    "resolvedBy"  TEXT,
    "resolutionNote" TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt"  TIMESTAMP(3),

    CONSTRAINT "listing_moderation_flags_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "listing_moderation_flags_productId_idx" ON "listing_moderation_flags"("productId");
CREATE INDEX "listing_moderation_flags_status_idx" ON "listing_moderation_flags"("status");

ALTER TABLE "listing_moderation_flags"
  ADD CONSTRAINT "listing_moderation_flags_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "listing_moderation_flags"
  ADD CONSTRAINT "listing_moderation_flags_resolvedBy_fkey"
  FOREIGN KEY ("resolvedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
