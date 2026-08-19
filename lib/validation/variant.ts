import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────
// Category attribute definitions (admin: "what options does this category
// support" — e.g. Clothing -> Size, Color; Skin Care -> Volume)
// ─────────────────────────────────────────────────────────────────────────

export const attributeTypeEnum = z.enum(["select", "color", "number"]);

const colorOptionSchema = z.object({
  name: z.string().min(1).max(40),
  hex: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Must be a hex color like #D85A30"),
});

export const createCategoryAttributeSchema = z
  .object({
    categoryId: z.string().uuid(),
    name: z.string().min(1, "Name is required.").max(60),
    key: z
      .string()
      .min(1)
      .max(40)
      .regex(/^[a-z][a-z0-9_]*$/, "Key must be lowercase letters, numbers, underscores, starting with a letter."),
    type: attributeTypeEnum,
    options: z.union([z.array(z.string().min(1)), z.array(colorOptionSchema)]).default([]),
    unit: z.string().max(10).optional(),
    isRequired: z.boolean().default(true),
    displayOrder: z.number().int().default(0),
  })
  .superRefine((data, ctx) => {
    if ((data.type === "select" || data.type === "color") && data.options.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["options"],
        message: "At least one option is required for select/color attributes.",
      });
    }
    if (data.type === "color") {
      const allHaveHex = data.options.every(
        (o) => typeof o === "object" && "hex" in o
      );
      if (!allHaveHex) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["options"],
          message: "Color attributes require { name, hex } objects.",
        });
      }
    }
  });

export const updateCategoryAttributeSchema = createCategoryAttributeSchema._def.schema
  .partial()
  .extend({ categoryId: z.string().uuid().optional() });

// ─────────────────────────────────────────────────────────────────────────
// Product variants
// ─────────────────────────────────────────────────────────────────────────

export const createVariantSchema = z.object({
  productId: z.string().uuid(),
  name: z.string().min(1, "Variant name is required.").max(150),
  sku: z.string().min(1, "SKU is required.").max(60),
  price: z.number().positive().nullable().optional(), // null = inherit from product
  stockQty: z.number().int().min(0).default(0),
  lowStockThreshold: z.number().int().min(0).default(5),
  weightGrams: z.number().int().positive().nullable().optional(),
  // Keys/values are validated against the category's CategoryAttribute rows
  // at the repository layer, since that requires a DB lookup Zod can't do alone.
  attributeValues: z.record(z.union([z.string(), z.number()])),
  isActive: z.boolean().default(true),
});

export const updateVariantSchema = createVariantSchema.partial().extend({
  productId: z.string().uuid().optional(),
});

export type CreateCategoryAttributeInput = z.infer<typeof createCategoryAttributeSchema>;
export type CreateVariantInput = z.infer<typeof createVariantSchema>;
