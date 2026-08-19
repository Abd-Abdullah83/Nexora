-- Phase 3: KYC / KYB Identity & Business Verification
-- Additive only. No existing table is altered except the addition of two
-- new relations on User and Seller (handled automatically by Prisma via
-- the FK constraints below — no column changes to existing tables).

-- ── 1. New enums ─────────────────────────────────────────────────────────
CREATE TYPE "SellerDocType" AS ENUM (
  'national_id',
  'passport',
  'business_registration',
  'trade_license',
  'tax_certificate'
);

CREATE TYPE "VerificationStatus" AS ENUM ('submitted', 'verified', 'rejected');

CREATE TYPE "IdentityType" AS ENUM (
  'national_id',
  'passport',
  'business_reg',
  'tax_id'
);

-- ── 2. seller_verifications ──────────────────────────────────────────────
CREATE TABLE "seller_verifications" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "docType" "SellerDocType" NOT NULL,
    "fileRef" TEXT NOT NULL,
    "status" "VerificationStatus" NOT NULL DEFAULT 'submitted',
    "rejectionReason" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seller_verifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "seller_verifications_sellerId_docType_key"
  ON "seller_verifications"("sellerId", "docType");
CREATE INDEX "seller_verifications_sellerId_idx" ON "seller_verifications"("sellerId");
CREATE INDEX "seller_verifications_status_idx" ON "seller_verifications"("status");

ALTER TABLE "seller_verifications" ADD CONSTRAINT "seller_verifications_sellerId_fkey"
    FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "seller_verifications" ADD CONSTRAINT "seller_verifications_reviewedBy_fkey"
    FOREIGN KEY ("reviewedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── 3. seller_identity_hashes ────────────────────────────────────────────
CREATE TABLE "seller_identity_hashes" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "identityType" "IdentityType" NOT NULL,
    "hash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seller_identity_hashes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "seller_identity_hashes_sellerId_identityType_key"
  ON "seller_identity_hashes"("sellerId", "identityType");
CREATE INDEX "seller_identity_hashes_hash_idx" ON "seller_identity_hashes"("hash");

ALTER TABLE "seller_identity_hashes" ADD CONSTRAINT "seller_identity_hashes_sellerId_fkey"
    FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Note: this migration does NOT alter the SellerStatus enum to add
-- pending_kyc/pending_approval — your uploaded schema.prisma shows those
-- values already exist in SellerStatus (added during Phase 2 per the
-- comment on that enum), so no enum change is needed here. If your actual
-- deployed database's SellerStatus enum does NOT yet have pending_kyc /
-- pending_approval, run this first as a separate migration before this
-- file (Postgres forbids using a freshly-added enum value in the same
-- transaction that added it):
--
--   ALTER TYPE "SellerStatus" ADD VALUE IF NOT EXISTS 'pending_kyc';
--   ALTER TYPE "SellerStatus" ADD VALUE IF NOT EXISTS 'pending_approval';
