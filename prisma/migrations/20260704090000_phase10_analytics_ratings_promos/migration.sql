-- Phase 10 (Part 1): Seller Ratings, Promotions & Store Rating Columns
-- Additive only. Assumes Phase 9 is already applied.

-- ── Store: add rating aggregate columns ──────────────────────────────────
ALTER TABLE "stores"
  ADD COLUMN IF NOT EXISTS "avgRating"   DECIMAL(3,2),
  ADD COLUMN IF NOT EXISTS "reviewCount" INTEGER NOT NULL DEFAULT 0;

-- ── New enum for SellerPromotion ─────────────────────────────────────────
CREATE TYPE "PromotionType" AS ENUM ('percentage', 'fixed_amount');

-- ── seller_promotions ─────────────────────────────────────────────────────
CREATE TABLE "seller_promotions" (
    "id"              TEXT NOT NULL,
    "sellerId"        TEXT NOT NULL,
    "code"            TEXT NOT NULL,
    "description"     TEXT,
    "promotionType"   "PromotionType" NOT NULL,
    "discountValue"   DECIMAL(10,2) NOT NULL,
    "productId"       TEXT,
    "minOrderAmount"  DECIMAL(10,2),
    "maxUses"         INTEGER,
    "usedCount"       INTEGER NOT NULL DEFAULT 0,
    "expiresAt"       TIMESTAMP(3),
    "isActive"        BOOLEAN NOT NULL DEFAULT true,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seller_promotions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "seller_promotions_code_key" ON "seller_promotions"("code");
CREATE INDEX "seller_promotions_sellerId_idx" ON "seller_promotions"("sellerId");
CREATE INDEX "seller_promotions_sellerId_isActive_idx" ON "seller_promotions"("sellerId", "isActive");
CREATE INDEX "seller_promotions_code_idx" ON "seller_promotions"("code");

ALTER TABLE "seller_promotions"
  ADD CONSTRAINT "seller_promotions_sellerId_fkey"
  FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "seller_promotions"
  ADD CONSTRAINT "seller_promotions_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
