// lib/validation/promotion.ts
import { z } from "zod";

const CODE_REGEX = /^[A-Z0-9_-]+$/;

export const createPromotionSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(3, "Code must be at least 3 characters.")
    .max(30, "Code must be 30 characters or less.")
    .regex(CODE_REGEX, "Code can only contain uppercase letters, numbers, hyphens, and underscores."),
  description: z.string().trim().max(200).optional(),
  promotionType: z.enum(["percentage", "fixed_amount"]),
  discountValue: z.coerce
    .number()
    .positive("Discount value must be greater than zero.")
    .max(100, "Percentage discount cannot exceed 100%."),
  productId: z.string().uuid().nullable().optional(),
  minOrderAmount: z.coerce.number().nonnegative().nullable().optional(),
  maxUses: z.coerce.number().int().positive().nullable().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
}).refine(
  (d) => {
    if (d.promotionType === "percentage" && d.discountValue > 100) return false;
    return true;
  },
  { message: "Percentage discount cannot exceed 100%.", path: ["discountValue"] }
);

export const validatePromotionSchema = z.object({
  code: z.string().min(1),
  subtotal: z.number().positive(),
  productIds: z.array(z.string()).optional(),
});
