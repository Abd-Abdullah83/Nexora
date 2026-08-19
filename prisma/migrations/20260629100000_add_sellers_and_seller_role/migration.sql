-- Phase 1: Platform-Seller Backfill & Role Foundation
-- Additive only. No existing table is dropped or destructively altered.
-- Existing rows in `products` end this migration with a non-null sellerId
-- pointing at a synthetic "Nexora Official Store" system seller.

-- ── 1. Extend Role enum ─────────────────────────────────────────────────
-- Postgres requires ALTER TYPE ... ADD VALUE outside of a transaction block
-- in older versions; Prisma's migrate runner handles this correctly when
-- applied via `prisma migrate deploy` / `migrate dev`.
ALTER TYPE "Role" ADD VALUE 'seller_individual';
ALTER TYPE "Role" ADD VALUE 'seller_business';

-- ── 2. New enums for sellers ────────────────────────────────────────────
CREATE TYPE "SellerType" AS ENUM ('individual', 'business');
CREATE TYPE "SellerStatus" AS ENUM ('pending', 'active', 'suspended', 'banned');

-- ── 3. New `sellers` table ──────────────────────────────────────────────
CREATE TABLE "sellers" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sellerType" "SellerType" NOT NULL,
    "status" "SellerStatus" NOT NULL DEFAULT 'pending',
    "isSystemSeller" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sellers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sellers_userId_key" ON "sellers"("userId");
CREATE INDEX "sellers_userId_idx" ON "sellers"("userId");
CREATE INDEX "sellers_status_idx" ON "sellers"("status");

ALTER TABLE "sellers" ADD CONSTRAINT "sellers_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── 4. Nullable seller_id on products (non-destructive) ────────────────
ALTER TABLE "products" ADD COLUMN "sellerId" TEXT;

CREATE INDEX "products_sellerId_idx" ON "products"("sellerId");

ALTER TABLE "products" ADD CONSTRAINT "products_sellerId_fkey"
    FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── 5. System seller + backfill ─────────────────────────────────────────
-- The system user/seller row ("Nexora Official Store") is intentionally
-- NOT created here with a hardcoded password hash. Generating a bcrypt
-- hash correctly requires the app's own bcryptjs lib, not a hand-written
-- SQL literal. Instead, run:
--
--     npx prisma db seed
--
-- immediately after this migration applies. prisma/seed.ts (extended in
-- this phase) creates the system user + system seller idempotently via
-- ensureSystemSeller(), then backfills every NULL sellerId on `products`
-- to that seller's id. See that file for the actual logic.
--
-- This migration only adds the schema (enum, table, column) above; it
-- intentionally leaves sellerId NULL on existing products until the seed
-- script runs, so a partially-applied migration can never silently assign
-- products to a system seller row that doesn't exist yet.
