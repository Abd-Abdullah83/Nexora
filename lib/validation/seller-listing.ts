// lib/validation/seller-listing.ts
//
// Seller-facing product listing schema. Deliberately narrower than the
// admin createProductSchema:
//
// EXCLUDED from seller control:
//   - isFeatured / isBestSeller / isNewArrival — platform-curated flags,
//     only admin can set these.
//   - costPrice — internal margin data, never visible to anyone but admin.
//   - aiSummary — platform-generated, no user input.
//
// Everything else a seller legitimately needs to list a product is here.
// Server-side only — never trust these values without Zod parsing on the
// route handler.

import { z } from "zod";

export const sellerListingCreateSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(500),
  description: z.string().trim().min(10, "Description must be at least 10 characters.").max(10000),
  shortDescription: z.string().trim().max(500).nullable().optional(),
  price: z.number().positive("Price must be greater than 0."),
  comparePrice: z.number().positive().nullable().optional(),
  salePrice: z.number().positive().nullable().optional(),
  saleEndsAt: z.string().datetime().nullable().optional(),
  categoryId: z.string().uuid("Invalid category."),
  // SKU is optional for sellers (unlike admin where it was required) —
  // smaller sellers often don't have their own SKU system.
  sku: z.string().trim().min(2).max(100).optional(),
  stockQty: z.number().int().min(0, "Stock cannot be negative.").default(0),
  lowStockThreshold: z.number().int().min(0).optional(),
  weightGrams: z.number().int().positive().nullable().optional(),
  currency: z.string().length(3).default("PKR"),
  videoUrl: z.string().url().nullable().optional(),
  status: z.enum(["draft", "active", "archived"]).default("draft"),
  tags: z.array(z.string().trim().max(50)).max(20).optional(),
  metaTitle: z.string().trim().max(255).nullable().optional(),
  metaDescription: z.string().trim().max(500).nullable().optional(),
});

// All fields optional on update — same as admin's updateProductSchema.
export const sellerListingUpdateSchema = sellerListingCreateSchema.partial();

export type SellerListingCreateInput = z.infer<typeof sellerListingCreateSchema>;
export type SellerListingUpdateInput = z.infer<typeof sellerListingUpdateSchema>;
