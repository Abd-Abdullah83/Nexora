// ─────────────────────────────────────────────────────────────────────────
// lib/sellers/settings.service.ts
// ─────────────────────────────────────────────────────────────────────────

import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors";

// ── Shipping ───────────────────────────────────────────────────────────

export async function getShippingSettings(sellerId: string) {
  return prisma.sellerShippingSettings.findUnique({ where: { sellerId } });
}

export async function upsertShippingSettings(
  sellerId: string,
  data: {
    zonesJson?: { region: string; rateAmount: number; currency: string }[];
    processingTimeDays?: number;
    carrierPrefsJson?: { carrierName: string; accountRef?: string }[];
  }
) {
  return prisma.sellerShippingSettings.upsert({
    where: { sellerId },
    create: { sellerId, ...data },
    update: data,
  });
}

// ── Return policy ──────────────────────────────────────────────────────

export async function getReturnPolicy(sellerId: string) {
  return prisma.sellerReturnPolicy.findUnique({ where: { sellerId } });
}

export async function upsertReturnPolicy(
  sellerId: string,
  data: { returnWindowDays: number; conditionsText?: string | null }
) {
  // Server-side enforcement against the Admin-configured marketplace
  // minimum — per the security review, this must never be UI-only.
  const settings = await prisma.marketplaceSettings.findUnique({ where: { id: "global" } });
  const minDays = settings?.minReturnWindowDays ?? 7;

  if (data.returnWindowDays < minDays) {
    throw new AppError("VALIDATION_ERROR", {
      returnWindowDays: `Return window must be at least ${minDays} days (marketplace minimum).`,
    });
  }

  return prisma.sellerReturnPolicy.upsert({
    where: { sellerId },
    create: { sellerId, ...data },
    update: data,
  });
}

// ── Tax settings ────────────────────────────────────────────────────────
// NOTE: a configurable flat-rate MECHANISM, not a tax-law compliance
// engine. The seller (or their accountant) is responsible for entering a
// legally correct rate — this only stores and applies whatever is given.

export async function getTaxSettings(sellerId: string) {
  return prisma.sellerTaxSettings.findUnique({ where: { sellerId } });
}

export async function upsertTaxSettings(
  sellerId: string,
  data: {
    taxRegistrationNumber?: string | null;
    regionRulesJson?: { region: string; ratePercent: number }[];
  }
) {
  if (data.regionRulesJson) {
    for (const rule of data.regionRulesJson) {
      if (rule.ratePercent < 0 || rule.ratePercent > 100) {
        throw new AppError("VALIDATION_ERROR", {
          regionRulesJson: `Tax rate for "${rule.region}" must be between 0 and 100.`,
        });
      }
    }
  }

  return prisma.sellerTaxSettings.upsert({
    where: { sellerId },
    create: { sellerId, ...data },
    update: data,
  });
}

/**
 * Computes tax for one seller's line items at checkout, using whatever
 * flat region rate they've configured (0 if none set — matches today's
 * existing behavior exactly, so a seller who never visits the tax
 * settings page sees no change). Called per-seller from the checkout
 * order-creation flow, once for each seller represented in the cart.
 */
export async function calculateTaxForSeller(
  sellerId: string,
  subtotalForThisSeller: number,
  region?: string
): Promise<number> {
  const settings = await prisma.sellerTaxSettings.findUnique({ where: { sellerId } });
  if (!settings) return 0;

  const rules = settings.regionRulesJson as { region: string; ratePercent: number }[];
  const rule = region ? rules.find((r) => r.region === region) : rules[0];
  if (!rule) return 0;

  return Math.round(subtotalForThisSeller * (rule.ratePercent / 100) * 100) / 100;
}
