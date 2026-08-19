-- Seller Appeal system — additive only, no changes to existing tables
-- except one new relation column on sellers is NOT needed (the FK lives
-- on seller_appeals, pointing back to sellers — standard one-to-many).

CREATE TYPE "SellerAppealStatus" AS ENUM (
  'open',
  'seller_replied',
  'admin_replied',
  'resolved_upheld',
  'resolved_lifted'
);

CREATE TYPE "AppealSenderRole" AS ENUM (
  'system',
  'seller',
  'admin'
);

CREATE TABLE "seller_appeals" (
    "id"           TEXT NOT NULL,
    "sellerId"     TEXT NOT NULL,
    "banRecordId"  TEXT,
    "status"       "SellerAppealStatus" NOT NULL DEFAULT 'open',
    "sellerUnread" INTEGER NOT NULL DEFAULT 0,
    "adminUnread"  INTEGER NOT NULL DEFAULT 0,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seller_appeals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "seller_appeals_sellerId_idx" ON "seller_appeals"("sellerId");
CREATE INDEX "seller_appeals_status_idx"   ON "seller_appeals"("status");

ALTER TABLE "seller_appeals"
  ADD CONSTRAINT "seller_appeals_sellerId_fkey"
  FOREIGN KEY ("sellerId") REFERENCES "sellers"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- banRecordId intentionally has NO foreign key — matches the existing
-- ban_evasion_alerts.matchedSellerId pattern already in this schema.

CREATE TABLE "seller_appeal_messages" (
    "id"         TEXT NOT NULL,
    "appealId"   TEXT NOT NULL,
    "senderRole" "AppealSenderRole" NOT NULL,
    "senderId"   TEXT,
    "body"       TEXT NOT NULL,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seller_appeal_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "seller_appeal_messages_appealId_idx" ON "seller_appeal_messages"("appealId");

ALTER TABLE "seller_appeal_messages"
  ADD CONSTRAINT "seller_appeal_messages_appealId_fkey"
  FOREIGN KEY ("appealId") REFERENCES "seller_appeals"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
