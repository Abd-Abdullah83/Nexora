-- Phase: Marketplace Listing Approval Gate (Part 2 of 2)
ALTER TABLE "sellers"
  ADD COLUMN IF NOT EXISTS "isTrustedSeller"      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "approvedListingCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "trustGrantedAt"        TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "trustGrantedBy"         TEXT;

ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "reviewedBy"      TEXT,
  ADD COLUMN IF NOT EXISTS "reviewedAt"      TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;

CREATE INDEX IF NOT EXISTS "products_status_idx" ON "products"("status")
  WHERE "status" = 'pending_review';