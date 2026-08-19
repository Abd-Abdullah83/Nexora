-- Phase 11 hardening: two-admin approval for permanent bans
--
-- The scaling doc recommends requiring agreement from both admins before
-- a permanent ban, given its irreversibility. Previously a single admin
-- could call banSeller() and it executed immediately. This adds a
-- request/confirm step: one admin requests a ban, a DIFFERENT admin must
-- confirm it before the actual ban (archive listings, cancel payouts,
-- freeze escrow, invalidate session) executes. Enforced server-side in
-- admin-seller.service.ts, not just in the UI.
--
-- Additive only. No existing table or column is altered.

CREATE TYPE "SellerBanRequestStatus" AS ENUM ('pending', 'confirmed', 'cancelled');

CREATE TABLE "seller_ban_requests" (
    "id"           TEXT NOT NULL,
    "sellerId"     TEXT NOT NULL,
    "reason"       TEXT NOT NULL,
    "status"       "SellerBanRequestStatus" NOT NULL DEFAULT 'pending',

    "requestedBy"  TEXT NOT NULL,
    "requestedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    "confirmedBy"  TEXT,
    "confirmedAt"  TIMESTAMP(3),

    "cancelledBy"  TEXT,
    "cancelledAt"  TIMESTAMP(3),

    CONSTRAINT "seller_ban_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "seller_ban_requests_sellerId_idx" ON "seller_ban_requests"("sellerId");
CREATE INDEX "seller_ban_requests_status_idx" ON "seller_ban_requests"("status");

-- Only one PENDING request per seller at a time. A partial unique index
-- (rather than a plain unique constraint) so a seller can accumulate a
-- history of confirmed/cancelled requests without conflict — only
-- "pending" is constrained to one.
CREATE UNIQUE INDEX "seller_ban_requests_one_pending_per_seller"
  ON "seller_ban_requests"("sellerId")
  WHERE "status" = 'pending';

ALTER TABLE "seller_ban_requests"
  ADD CONSTRAINT "seller_ban_requests_sellerId_fkey"
  FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "seller_ban_requests"
  ADD CONSTRAINT "seller_ban_requests_requestedBy_fkey"
  FOREIGN KEY ("requestedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "seller_ban_requests"
  ADD CONSTRAINT "seller_ban_requests_confirmedBy_fkey"
  FOREIGN KEY ("confirmedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "seller_ban_requests"
  ADD CONSTRAINT "seller_ban_requests_cancelledBy_fkey"
  FOREIGN KEY ("cancelledBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
