-- Phase 4: Store Setup, Settings & Subscription Billing
-- Additive only — no existing table altered.

-- ── New enums ────────────────────────────────────────────────────────────
CREATE TYPE "SubscriptionPlan" AS ENUM ('individual', 'business');
CREATE TYPE "SubscriptionStatus" AS ENUM ('trialing', 'active', 'past_due', 'cancelled');
CREATE TYPE "InvoiceStatus" AS ENUM ('pending', 'paid', 'failed');

-- ── stores ───────────────────────────────────────────────────────────────
CREATE TABLE "stores" (
    "id"          TEXT NOT NULL,
    "sellerId"    TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "slug"        TEXT NOT NULL,
    "logoUrl"     TEXT,
    "bannerUrl"   TEXT,
    "description" TEXT,
    "themeJson"   JSONB NOT NULL DEFAULT '{}',
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stores_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "stores_sellerId_key" ON "stores"("sellerId");
CREATE UNIQUE INDEX "stores_slug_key" ON "stores"("slug");
CREATE INDEX "stores_slug_idx" ON "stores"("slug");

ALTER TABLE "stores" ADD CONSTRAINT "stores_sellerId_fkey"
    FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── seller_subscriptions ─────────────────────────────────────────────────
CREATE TABLE "seller_subscriptions" (
    "id"               TEXT NOT NULL,
    "sellerId"         TEXT NOT NULL,
    "plan"             "SubscriptionPlan" NOT NULL,
    "status"           "SubscriptionStatus" NOT NULL DEFAULT 'trialing',
    "trialEndAt"       TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3),
    "pastDueSince"     TIMESTAMP(3),
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seller_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "seller_subscriptions_sellerId_key" ON "seller_subscriptions"("sellerId");
CREATE INDEX "seller_subscriptions_sellerId_idx" ON "seller_subscriptions"("sellerId");
CREATE INDEX "seller_subscriptions_status_idx" ON "seller_subscriptions"("status");

ALTER TABLE "seller_subscriptions" ADD CONSTRAINT "seller_subscriptions_sellerId_fkey"
    FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── subscription_invoices ────────────────────────────────────────────────
CREATE TABLE "subscription_invoices" (
    "id"                 TEXT NOT NULL,
    "sellerId"           TEXT NOT NULL,
    "amount"             DECIMAL(10,2) NOT NULL,
    "currency"           CHAR(3) NOT NULL DEFAULT 'USD',
    "status"             "InvoiceStatus" NOT NULL DEFAULT 'pending',
    "billingPeriodStart" TIMESTAMP(3) NOT NULL,
    "billingPeriodEnd"   TIMESTAMP(3) NOT NULL,
    "paidAt"             TIMESTAMP(3),
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_invoices_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "subscription_invoices_sellerId_idx" ON "subscription_invoices"("sellerId");
CREATE INDEX "subscription_invoices_status_idx" ON "subscription_invoices"("status");

ALTER TABLE "subscription_invoices" ADD CONSTRAINT "subscription_invoices_sellerId_fkey"
    FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── seller_shipping_settings ─────────────────────────────────────────────
CREATE TABLE "seller_shipping_settings" (
    "id"                 TEXT NOT NULL,
    "sellerId"           TEXT NOT NULL,
    "zonesJson"          JSONB NOT NULL DEFAULT '[]',
    "processingTimeDays" INTEGER NOT NULL DEFAULT 2,
    "carrierPrefsJson"   JSONB NOT NULL DEFAULT '[]',
    "updatedAt"          TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seller_shipping_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "seller_shipping_settings_sellerId_key" ON "seller_shipping_settings"("sellerId");

ALTER TABLE "seller_shipping_settings" ADD CONSTRAINT "seller_shipping_settings_sellerId_fkey"
    FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── seller_return_policies ───────────────────────────────────────────────
CREATE TABLE "seller_return_policies" (
    "id"               TEXT NOT NULL,
    "sellerId"         TEXT NOT NULL,
    "returnWindowDays" INTEGER NOT NULL DEFAULT 7,
    "conditionsText"   TEXT,
    "updatedAt"        TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seller_return_policies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "seller_return_policies_sellerId_key" ON "seller_return_policies"("sellerId");

ALTER TABLE "seller_return_policies" ADD CONSTRAINT "seller_return_policies_sellerId_fkey"
    FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── seller_tax_settings ──────────────────────────────────────────────────
CREATE TABLE "seller_tax_settings" (
    "id"                     TEXT NOT NULL,
    "sellerId"               TEXT NOT NULL,
    "taxRegistrationNumber"  TEXT,
    "regionRulesJson"        JSONB NOT NULL DEFAULT '[]',
    "updatedAt"              TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seller_tax_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "seller_tax_settings_sellerId_key" ON "seller_tax_settings"("sellerId");

ALTER TABLE "seller_tax_settings" ADD CONSTRAINT "seller_tax_settings_sellerId_fkey"
    FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── marketplace_settings (singleton) ─────────────────────────────────────
CREATE TABLE "marketplace_settings" (
    "id"                  TEXT NOT NULL DEFAULT 'global',
    "minReturnWindowDays" INTEGER NOT NULL DEFAULT 7,
    "updatedAt"           TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketplace_settings_pkey" PRIMARY KEY ("id")
);

-- Seed the single row this table will ever have.
INSERT INTO "marketplace_settings" ("id", "minReturnWindowDays", "updatedAt")
VALUES ('global', 7, CURRENT_TIMESTAMP);
