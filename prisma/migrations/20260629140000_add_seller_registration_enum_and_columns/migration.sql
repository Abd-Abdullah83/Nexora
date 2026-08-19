-- Phase 2 — Seller Registration & Email/Phone Verification
--
-- This is the migration that should have shipped with phase-2part1 but
-- didn't — the zip's own migration.sql only created seller_otp_logs (see
-- the sibling 20260629120000_add_seller_otp_logs migration), with a comment
-- admitting the schema.prisma changes for SellerStatus and the new Seller
-- columns were "documented but never actually included." Without this,
-- seller.service.ts will not run against a real database — every status
-- transition and every field it reads/writes (displayName, businessEmail,
-- phoneOtp, etc.) depends on columns this migration adds.
--
-- Additive only. No existing column or table is dropped or altered
-- destructively.
--
-- SPLIT INTO TWO MIGRATIONS ON PURPOSE — DO NOT MERGE BACK INTO ONE FILE.
-- PostgreSQL does not allow a newly-added enum value (ALTER TYPE ... ADD
-- VALUE) to be USED — in a DEFAULT clause, an UPDATE, an INSERT, anywhere
-- — within the same transaction that added it. Prisma applies each
-- migration.sql file as a single transaction, so the ADD VALUE statements
-- below must finish and commit (i.e. this migration must fully apply)
-- BEFORE the next migration (20260629140100_seller_status_default_and_
-- backfill) can reference 'pending_email_verification' etc. as a literal.
-- Apply them in order, as separate `prisma migrate deploy` runs do
-- automatically — just don't combine the two files.

-- ── 1. Extend SellerStatus enum ─────────────────────────────────────────
-- IMPORTANT: Postgres cannot drop an enum value. Phase 1's 'pending' is
-- NOT removed here — it stays in the type permanently (unused going
-- forward) rather than attempting something Postgres doesn't support.
-- schema.prisma's enum declaration omits 'pending' from this point on, but
-- the data migration in the next file guarantees no row is ever left
-- holding a value Prisma's generated type can't represent.
ALTER TYPE "SellerStatus" ADD VALUE 'pending_email_verification';
ALTER TYPE "SellerStatus" ADD VALUE 'pending_phone_verification';
ALTER TYPE "SellerStatus" ADD VALUE 'pending_kyc';
ALTER TYPE "SellerStatus" ADD VALUE 'pending_approval';
ALTER TYPE "SellerStatus" ADD VALUE 'rejected';

-- ── 2. New columns on `sellers` (no enum-literal usage — safe here) ─────
ALTER TABLE "sellers" ADD COLUMN "displayName" TEXT;
ALTER TABLE "sellers" ADD COLUMN "businessEmail" TEXT;
ALTER TABLE "sellers" ADD COLUMN "businessPhone" TEXT;

ALTER TABLE "sellers" ADD COLUMN "emailVerifyToken" TEXT;
ALTER TABLE "sellers" ADD COLUMN "emailVerifyExpires" TIMESTAMP(3);
ALTER TABLE "sellers" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);

ALTER TABLE "sellers" ADD COLUMN "phoneOtp" TEXT;
ALTER TABLE "sellers" ADD COLUMN "phoneOtpExpires" TIMESTAMP(3);
ALTER TABLE "sellers" ADD COLUMN "phoneOtpAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "sellers" ADD COLUMN "phoneVerifiedAt" TIMESTAMP(3);

ALTER TABLE "sellers" ADD COLUMN "agreedToTermsAt" TIMESTAMP(3);
ALTER TABLE "sellers" ADD COLUMN "agreedToTermsVersion" TEXT;

ALTER TABLE "sellers" ADD COLUMN "registrationIp" TEXT;
ALTER TABLE "sellers" ADD COLUMN "registrationUserAgent" TEXT;

-- ── 3. Indexes (no enum-literal usage — safe here) ───────────────────────
CREATE INDEX "sellers_businessEmail_idx" ON "sellers"("businessEmail");
CREATE INDEX "sellers_businessPhone_idx" ON "sellers"("businessPhone");
CREATE INDEX "sellers_emailVerifyToken_idx" ON "sellers"("emailVerifyToken");
