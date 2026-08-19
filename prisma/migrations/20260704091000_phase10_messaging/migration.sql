-- Phase 10 (Part 2): Buyer-to-Seller Messaging
-- Kept as a SEPARATE migration from Part 1 for the same reason Phase 2's
-- two migrations were split: Postgres requires a newly created enum value
-- to be committed in its own transaction before it can be used in a
-- column definition. Running both migrations in sequence (Part 1 then
-- Part 2) with `npx prisma migrate deploy` handles this automatically.

-- ── New enums ─────────────────────────────────────────────────────────────
CREATE TYPE "MessageSenderRole" AS ENUM ('buyer', 'seller');

-- ── message_threads ───────────────────────────────────────────────────────
CREATE TABLE "message_threads" (
    "id"           TEXT NOT NULL,
    "sellerId"     TEXT NOT NULL,
    "buyerId"      TEXT NOT NULL,
    "orderId"      TEXT NOT NULL,
    "sellerUnread" INTEGER NOT NULL DEFAULT 0,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "message_threads_pkey" PRIMARY KEY ("id")
);

-- One thread per (buyer, seller, order) tuple
CREATE UNIQUE INDEX "message_threads_buyerId_sellerId_orderId_key"
  ON "message_threads"("buyerId", "sellerId", "orderId");

CREATE INDEX "message_threads_sellerId_idx" ON "message_threads"("sellerId");
CREATE INDEX "message_threads_buyerId_idx" ON "message_threads"("buyerId");
CREATE INDEX "message_threads_sellerId_sellerUnread_idx"
  ON "message_threads"("sellerId", "sellerUnread");

ALTER TABLE "message_threads"
  ADD CONSTRAINT "message_threads_sellerId_fkey"
  FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "message_threads"
  ADD CONSTRAINT "message_threads_buyerId_fkey"
  FOREIGN KEY ("buyerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "message_threads"
  ADD CONSTRAINT "message_threads_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── messages ──────────────────────────────────────────────────────────────
CREATE TABLE "messages" (
    "id"         TEXT NOT NULL,
    "threadId"   TEXT NOT NULL,
    "senderRole" "MessageSenderRole" NOT NULL,
    "senderId"   TEXT NOT NULL,
    "body"       TEXT NOT NULL,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "messages_threadId_idx" ON "messages"("threadId");

ALTER TABLE "messages"
  ADD CONSTRAINT "messages_threadId_fkey"
  FOREIGN KEY ("threadId") REFERENCES "message_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "messages"
  ADD CONSTRAINT "messages_senderId_fkey"
  FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
