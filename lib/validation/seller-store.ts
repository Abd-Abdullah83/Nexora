import { z } from "zod";

const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const storeUpsertSchema = z.object({
  name: z.string().trim().min(2, "Store name must be at least 2 characters.").max(100),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(60)
    .regex(SLUG_REGEX, "Store URL can only contain lowercase letters, numbers, and hyphens.")
    .optional(),
  logoUrl: z.string().url().nullable().optional(),
  bannerUrl: z.string().url().nullable().optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  themeJson: z
    .object({
      primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    })
    .strict()
    .optional(),
});

const shippingZoneSchema = z.object({
  region: z.string().trim().min(1).max(100),
  rateAmount: z.number().nonnegative(),
  currency: z.string().length(3).default("PKR"),
});

const carrierPrefSchema = z.object({
  carrierName: z.string().trim().min(1).max(100),
  accountRef: z.string().trim().max(100).optional(),
});

export const shippingSettingsSchema = z.object({
  zonesJson: z.array(shippingZoneSchema).max(50).optional(),
  processingTimeDays: z.coerce.number().int().min(0).max(30).optional(),
  carrierPrefsJson: z.array(carrierPrefSchema).max(20).optional(),
});

export const returnPolicySchema = z.object({
  returnWindowDays: z.coerce.number().int().min(0).max(365),
  conditionsText: z.string().trim().max(2000).nullable().optional(),
});

const taxRegionRuleSchema = z.object({
  region: z.string().trim().min(1).max(100),
  ratePercent: z.coerce.number().min(0).max(100),
});

export const taxSettingsSchema = z.object({
  taxRegistrationNumber: z.string().trim().max(50).nullable().optional(),
  regionRulesJson: z.array(taxRegionRuleSchema).max(50).optional(),
});
