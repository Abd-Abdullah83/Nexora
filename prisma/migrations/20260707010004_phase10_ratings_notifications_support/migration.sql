-- Phase 10 gap fill: Seller Ratings, Notifications, Support Center
-- Additive only. Three independent features, no shared dependencies
-- between them, safe to apply as one migration.

-- ── 1. Seller ratings aggregate ──────────────────────────────────────────
CREATE TABLE "seller_ratings_aggregates" (
    "id"                  TEXT NOT NULL,
    "sellerId"            TEXT NOT NULL,
    "avgRating"           DECIMAL(3,2) NOT NULL DEFAULT 0,
    "totalReviews"        INTEGER NOT NULL DEFAULT 0,
    "onTimeDeliveryRate"  DECIMAL(5,2) NOT NULL DEFAULT 0,
    "disputeRate"         DECIMAL(5,2) NOT NULL DEFAULT 0,
    "updatedAt"           TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seller_ratings_aggregates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "seller_ratings_aggregates_sellerId_key" ON "seller_ratings_aggregates"("sellerId");

ALTER TABLE "seller_ratings_aggregates"
  ADD CONSTRAINT "seller_ratings_aggregates_sellerId_fkey"
  FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── 2. Notifications ──────────────────────────────────────────────────────
CREATE TYPE "NotificationType" AS ENUM (
  'order_status_changed',
  'dispute_opened',
  'dispute_resolved',
  'payout_paid',
  'payout_failed',
  'listing_moderation',
  'support_ticket_reply'
);

CREATE TABLE "notifications" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "type"      "NotificationType" NOT NULL,
    "payload"   JSONB NOT NULL DEFAULT '{}',
    "readAt"    TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "notifications_userId_readAt_idx" ON "notifications"("userId", "readAt");
CREATE INDEX "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt" DESC);

ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── 3. Support tickets ────────────────────────────────────────────────────
-- Deliberately a SEPARATE thread/message pair from the existing
-- message_threads/messages tables (Phase 10's buyer-seller messaging).
-- MessageThread requires a non-nullable buyerId + orderId — a support
-- ticket is a seller<->Admin conversation with neither. Rather than
-- loosen an already-shipped, working table's required columns, this adds
-- a dedicated pair. Zero risk to existing messaging.
CREATE TYPE "SupportTicketStatus" AS ENUM ('open', 'in_progress', 'resolved', 'closed');
CREATE TYPE "SupportTicketPriority" AS ENUM ('low', 'normal', 'high', 'urgent');
CREATE TYPE "SupportSenderRole" AS ENUM ('seller', 'admin');

CREATE TABLE "support_tickets" (
    "id"         TEXT NOT NULL,
    "sellerId"   TEXT NOT NULL,
    "subject"    TEXT NOT NULL,
    "status"     "SupportTicketStatus" NOT NULL DEFAULT 'open',
    "priority"   "SupportTicketPriority" NOT NULL DEFAULT 'normal',
    "assignedTo" TEXT,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "support_tickets_sellerId_idx" ON "support_tickets"("sellerId");
CREATE INDEX "support_tickets_status_idx" ON "support_tickets"("status");

ALTER TABLE "support_tickets"
  ADD CONSTRAINT "support_tickets_sellerId_fkey"
  FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "support_tickets"
  ADD CONSTRAINT "support_tickets_assignedTo_fkey"
  FOREIGN KEY ("assignedTo") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "support_ticket_messages" (
    "id"         TEXT NOT NULL,
    "ticketId"   TEXT NOT NULL,
    "senderRole" "SupportSenderRole" NOT NULL,
    "senderId"   TEXT NOT NULL,
    "body"       TEXT NOT NULL,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_ticket_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "support_ticket_messages_ticketId_idx" ON "support_ticket_messages"("ticketId");

ALTER TABLE "support_ticket_messages"
  ADD CONSTRAINT "support_ticket_messages_ticketId_fkey"
  FOREIGN KEY ("ticketId") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "support_ticket_messages"
  ADD CONSTRAINT "support_ticket_messages_senderId_fkey"
  FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
