-- Phase 6: Seller-Scoped Order Management
-- Additive only. Adds sellerId (backfilled from each order_item's product
-- at migration time) and a per-line fulfillment status, since one buyer
-- order can now span multiple sellers and each seller must independently
-- mark their own portion shipped/delivered without touching another
-- seller's lines on the same order.

-- ── 1. New enum for per-line fulfillment status ───────────────────────────
-- Deliberately separate from the existing OrderStatus enum (which still
-- represents the buyer-facing, whole-order status). A multi-seller order's
-- OrderStatus becomes a derived/aggregate concept once Phase 7 lands —
-- not solved in this phase, see migration footer note.
CREATE TYPE "OrderItemFulfillmentStatus" AS ENUM (
  'pending',
  'confirmed',
  'shipped',
  'delivered',
  'cancelled'
);

-- ── 2. Add sellerId + fulfillment columns to order_items ──────────────────
ALTER TABLE "order_items"
  ADD COLUMN IF NOT EXISTS "sellerId"           TEXT,
  ADD COLUMN IF NOT EXISTS "fulfillmentStatus"  "OrderItemFulfillmentStatus" NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS "sellerTrackingNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "sellerTrackingUrl"    TEXT,
  ADD COLUMN IF NOT EXISTS "shippedAt"          TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deliveredAt"        TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "cancelledAt"        TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "cancellationReason" TEXT;

-- ── 3. Backfill sellerId for every existing order_item ────────────────────
-- Every product already has a sellerId (Phase 1 backfilled all pre-existing
-- products onto the system seller). Copy that forward onto every historical
-- order line so no row is left with sellerId = NULL after this migration.
UPDATE "order_items" oi
SET "sellerId" = p."sellerId"
FROM "products" p
WHERE oi."productId" = p."id"
  AND oi."sellerId" IS NULL;

-- ── 4. Enforce NOT NULL now that backfill is complete ─────────────────────
-- Safe because every product row has a non-null sellerId since Phase 1,
-- so the UPDATE above is guaranteed to have filled every order_items row
-- (a product can't be deleted out from under an order_item — onDelete is
-- not Cascade on that relation).
ALTER TABLE "order_items" ALTER COLUMN "sellerId" SET NOT NULL;

-- ── 5. FK + indexes ────────────────────────────────────────────────────────
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_sellerId_fkey"
    FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "order_items_sellerId_idx" ON "order_items"("sellerId");
CREATE INDEX IF NOT EXISTS "order_items_sellerId_fulfillmentStatus_idx"
  ON "order_items"("sellerId", "fulfillmentStatus");

-- ── Note for a later phase ──────────────────────────────────────────────
-- This migration deliberately does NOT touch the parent orders.status
-- column. A buyer order containing items from 3 different sellers now has
-- ONE OrderStatus (legacy, whole-order) and up to 3 independent
-- OrderItemFulfillmentStatus values (new, per-seller). Reconciling those
-- two into a single buyer-facing "order status" display (e.g. "partially
-- shipped") is a presentation-layer concern, handled in
-- lib/sellers/seller-orders.service.ts's deriveBuyerFacingStatus() helper
-- in this same delivery — not a schema change.
