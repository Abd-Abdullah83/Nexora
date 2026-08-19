import { z } from "zod";

export const createProductSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters.").max(255),
  description: z.string().min(10, "Description must be at least 10 characters."),
  shortDescription: z.string().max(500).optional(),
  price: z.number().positive("Price must be greater than 0."),
  comparePrice: z.number().positive().optional().nullable(),
  salePrice: z.number().positive().optional().nullable(),
  saleEndsAt: z.string().datetime().optional().nullable(),
  costPrice: z.number().positive().optional().nullable(),
  categoryId: z.string().uuid("Invalid category."),
  sku: z.string().min(2, "SKU is required.").max(100),
  stockQty: z.number().int().min(0, "Stock cannot be negative."),
  lowStockThreshold: z.number().int().min(0).optional(),
  weightGrams: z.number().int().positive().optional().nullable(),
  currency: z.string().min(3).max(3).default("PKR"),
  videoUrl: z.string().url().optional().nullable(),
  status: z.enum(["draft", "active", "archived"]).optional(),
  isFeatured: z.boolean().optional(),
  isBestSeller: z.boolean().optional(),
  isNewArrival: z.boolean().optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  metaTitle: z.string().max(255).optional(),
  metaDescription: z.string().max(500).optional(),
});

export const updateProductSchema = createProductSchema.partial();

export const createCategorySchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters.").max(100),
  description: z.string().max(1000).optional(),
  imageUrl: z.string().url().optional(),
  parentId: z.string().uuid().optional().nullable(),
  displayOrder: z.number().int().optional(),
});

export const updateCategorySchema = createCategorySchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const productSearchSchema = z.object({
  q: z.string().max(200).optional(),
  category: z.string().max(100).optional(),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().positive().optional(),
  sort: z.enum(["newest", "price_asc", "price_desc", "name_asc"]).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
