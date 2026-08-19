-- Category Requests + Store Asset Upload Tracking
-- Additive only. Two independent features, safe to apply as one migration.

-- ── 1. Category requests ──────────────────────────────────────────────────
CREATE TYPE "CategoryRequestStatus" AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE "category_requests" (
    "id"                 TEXT NOT NULL,
    "sellerId"           TEXT NOT NULL,
    "name"               TEXT NOT NULL,
    "description"        TEXT,
    "parentId"           TEXT,
    "status"             "CategoryRequestStatus" NOT NULL DEFAULT 'pending',
    "resolvedCategoryId" TEXT,
    "reviewedBy"         TEXT,
    "reviewedAt"         TIMESTAMP(3),
    "resolutionNote"     TEXT,
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3) NOT NULL,

    CONSTRAINT "category_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "category_requests_sellerId_idx" ON "category_requests"("sellerId");
CREATE INDEX "category_requests_status_idx" ON "category_requests"("status");

ALTER TABLE "category_requests"
  ADD CONSTRAINT "category_requests_sellerId_fkey"
  FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "category_requests"
  ADD CONSTRAINT "category_requests_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "category_requests"
  ADD CONSTRAINT "category_requests_resolvedCategoryId_fkey"
  FOREIGN KEY ("resolvedCategoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "category_requests"
  ADD CONSTRAINT "category_requests_reviewedBy_fkey"
  FOREIGN KEY ("reviewedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── 2. Store asset public_id tracking (for clean replace/delete) ─────────
ALTER TABLE "stores"
  ADD COLUMN "logoPublicId"   TEXT,
  ADD COLUMN "bannerPublicId" TEXT;
