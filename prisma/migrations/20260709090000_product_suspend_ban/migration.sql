-- Product-level admin enforcement: suspend (single admin) + ban (two-admin
-- approval), mirroring the SellerBanRequest pattern exactly.
--
-- Why this is separate from the existing seller-level ban system: banning
-- a SELLER's whole account and suspending/banning ONE of their LISTINGS
-- are different-severity actions. A seller can have 50 listings and one
-- bad one — admin needs to act on that single product without touching
-- the seller's account or their other 49 listings.
--
-- No enum-literal is used as a DEFAULT or in an UPDATE/INSERT anywhere in
-- this file, so unlike the Phase 2/3/11 migrations, this does NOT need to
-- be split across a transaction boundary — ALTER TYPE ADD VALUE and the
-- new ProductBanRequest table (which references a brand-new, not-altered
-- type) can safely coexist in one file.

-- ── 1. Extend ProductStatus ───────────────────────────────────────────────
ALTER TYPE "ProductStatus" ADD VALUE 'admin_suspended';
ALTER TYPE "ProductStatus" ADD VALUE 'admin_banned';

-- ── 2. Extend NotificationType — seller must be told why ─────────────────
ALTER TYPE "NotificationType" ADD VALUE 'listing_suspended';
ALTER TYPE "NotificationType" ADD VALUE 'listing_banned';

-- ── 3. New columns on products ────────────────────────────────────────────
-- Mirrors the exact fields already on `sellers` for account-level bans —
-- same shape, one level down.
ALTER TABLE "products" ADD COLUMN "suspendedAt"      TIMESTAMP(3);
ALTER TABLE "products" ADD COLUMN "suspendedBy"      TEXT;
ALTER TABLE "products" ADD COLUMN "suspensionReason" TEXT;
ALTER TABLE "products" ADD COLUMN "bannedAt"          TIMESTAMP(3);
ALTER TABLE "products" ADD COLUMN "bannedBy"          TEXT;
ALTER TABLE "products" ADD COLUMN "banReason"         TEXT;

ALTER TABLE "products"
  ADD CONSTRAINT "products_suspendedBy_fkey"
  FOREIGN KEY ("suspendedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "products"
  ADD CONSTRAINT "products_bannedBy_fkey"
  FOREIGN KEY ("bannedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── 4. Two-admin ban request table ────────────────────────────────────────
CREATE TYPE "ProductBanRequestStatus" AS ENUM ('pending', 'confirmed', 'cancelled');

CREATE TABLE "product_ban_requests" (
    "id"          TEXT NOT NULL,
    "productId"   TEXT NOT NULL,
    "reason"      TEXT NOT NULL,
    "status"      "ProductBanRequestStatus" NOT NULL DEFAULT 'pending',

    "requestedBy" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    "confirmedBy" TEXT,
    "confirmedAt" TIMESTAMP(3),

    "cancelledBy" TEXT,
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "product_ban_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "product_ban_requests_productId_idx" ON "product_ban_requests"("productId");
CREATE INDEX "product_ban_requests_status_idx" ON "product_ban_requests"("status");

-- Only one PENDING request per product at a time — same partial-unique
-- pattern as seller_ban_requests.
CREATE UNIQUE INDEX "product_ban_requests_one_pending_per_product"
  ON "product_ban_requests"("productId")
  WHERE "status" = 'pending';

ALTER TABLE "product_ban_requests"
  ADD CONSTRAINT "product_ban_requests_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "product_ban_requests"
  ADD CONSTRAINT "product_ban_requests_requestedBy_fkey"
  FOREIGN KEY ("requestedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "product_ban_requests"
  ADD CONSTRAINT "product_ban_requests_confirmedBy_fkey"
  FOREIGN KEY ("confirmedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "product_ban_requests"
  ADD CONSTRAINT "product_ban_requests_cancelledBy_fkey"
  FOREIGN KEY ("cancelledBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
