// lib/validation/seller-enforcement.ts
// Phase 11 — Zod schemas for admin enforcement actions.

import { z } from "zod";

export const banSellerSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(10, "Ban reason must be at least 10 characters.")
    .max(1000),
});

export const suspendSellerSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(10, "Suspension reason must be at least 10 characters.")
    .max(1000),
  // ISO 8601 date string or null (null = indefinite suspension)
  suspendedUntil: z
    .string()
    .datetime({ message: "Must be a valid ISO 8601 datetime." })
    .nullable()
    .optional(),
});

export const reinstateSellerSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(10, "Reinstatement reason must be at least 10 characters.")
    .max(1000),
});

export const resolveBanEvasionAlertSchema = z.object({
  adminNote: z
    .string()
    .trim()
    .min(10, "Note must be at least 10 characters — document your reasoning.")
    .max(1000),
});

export const listSellersQuerySchema = z.object({
  status: z
    .enum(["pending_email_verification", "pending_phone_verification", "pending_kyc",
           "pending_approval", "active", "suspended", "banned"])
    .optional(),
  sellerType: z.enum(["individual", "business"]).optional(),
  search: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
});

export type BanSellerInput = z.infer<typeof banSellerSchema>;
export type SuspendSellerInput = z.infer<typeof suspendSellerSchema>;
export type ReinstateSeller = z.infer<typeof reinstateSellerSchema>;
