import { z } from "zod";

export const createCategoryRequestSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(100),
  parentId: z.string().uuid().nullable().optional(),
  description: z.string().trim().max(1000).nullable().optional(),
});

export const resolveCategoryRequestSchema = z
  .object({
    action: z.enum(["approve", "reject"]),
    note: z.string().trim().max(500).optional(),
    displayOrder: z.coerce.number().int().min(0).optional(),
  })
  .refine((data) => data.action !== "reject" || !!data.note, {
    message: "A note is required when rejecting a category request.",
    path: ["note"],
  });

export type CreateCategoryRequestInput = z.infer<typeof createCategoryRequestSchema>;
export type ResolveCategoryRequestInput = z.infer<typeof resolveCategoryRequestSchema>;
