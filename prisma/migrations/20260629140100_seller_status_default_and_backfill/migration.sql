-- Phase 2 (part 2 of 2) — must run AFTER
-- 20260629140000_add_seller_registration_enum_and_columns has fully
-- applied. See that file's header comment for why this is split out:
-- Postgres forbids using a newly-added enum value within the same
-- transaction that added it, and Prisma applies each migration.sql as one
-- transaction.

-- ── 1. New default for the status column ────────────────────────────────
-- New sellers should start at pending_email_verification, not the old
-- pending.
ALTER TABLE "sellers" ALTER COLUMN "status" SET DEFAULT 'pending_email_verification';

-- ── 2. Data migration: move any existing 'pending' rows forward ─────────
-- Defensive, not strictly known to be necessary — Phase 1's system seller
-- was created with status 'active', not 'pending', so there is likely no
-- row to move. Run regardless: cheap, and guarantees no row is ever left
-- on a value schema.prisma's TypeScript enum no longer represents, which
-- would otherwise surface as a Prisma runtime deserialization error the
-- first time that row is read.
UPDATE "sellers" SET "status" = 'pending_email_verification' WHERE "status" = 'pending';
