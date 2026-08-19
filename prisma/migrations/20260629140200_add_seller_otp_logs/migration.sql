-- Phase 2 (follow-up) — Add the seller_otp_logs table.
--
-- This was documented in SCHEMA_CHANGES.md but never actually included in
-- the migration.sql that shipped with it — seller.service.ts already
-- calls prisma.sellerOtpLog throughout, so without this table the service
-- layer doesn't compile/run at all. Provided as a SEPARATE migration
-- (rather than edited into the original one) since that one may already
-- be applied to your database — additive, safe to run regardless.

CREATE TABLE IF NOT EXISTS "seller_otp_logs" (
  "id"        TEXT NOT NULL,
  "sellerId"  TEXT NOT NULL,
  "phone"     TEXT NOT NULL,
  "otpHash"   TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt"    TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "seller_otp_logs_pkey" PRIMARY KEY ("id")
);

-- Composite index matching the exact rate-limit query shape used in
-- requestPhoneOtp() (sellerId + phone + createdAt range).
CREATE INDEX IF NOT EXISTS "seller_otp_logs_sellerId_phone_createdAt_idx"
  ON "seller_otp_logs"("sellerId", "phone", "createdAt");

-- Foreign key to sellers, with cascade delete — if a seller row is ever
-- deleted, its OTP history goes with it rather than becoming orphaned.
ALTER TABLE "seller_otp_logs"
  ADD CONSTRAINT "seller_otp_logs_sellerId_fkey"
  FOREIGN KEY ("sellerId") REFERENCES "sellers"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
