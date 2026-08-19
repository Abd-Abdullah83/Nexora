import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import { AppError } from "@/lib/errors";
import type { CreateVariantInput } from "@/lib/validation/variant";

// ─────────────────────────────────────────────────────────────────────────
// Category attributes (admin: defining what options a category supports)
// ─────────────────────────────────────────────────────────────────────────

export async function getCategoryAttributes(categoryId: string) {
  return prisma.categoryAttribute.findMany({
    where: { categoryId },
    orderBy: { displayOrder: "asc" },
  });
}

export async function createCategoryAttribute(data: {
  categoryId: string;
  name: string;
  key: string;
  type: "select" | "color" | "number";
  options: unknown[];
  unit?: string;
  isRequired: boolean;
  displayOrder: number;
}) {
  return prisma.categoryAttribute.create({
    data: {
      ...data,
      // options is validated as an array of strings or {name,hex} objects
      // by createCategoryAttributeSchema before this is ever called — this
      // cast is just telling Prisma's generic JSON input type that, not
      // loosening anything at the actual validation boundary.
      options: data.options as Prisma.InputJsonValue,
    },
  });
}

export async function deleteCategoryAttribute(id: string) {
  return prisma.categoryAttribute.delete({ where: { id } });
}

// ─────────────────────────────────────────────────────────────────────────
// Variant validation — checks attributeValues against the product's
// category's defined attributes. This is the part Zod alone can't do,
// since it requires a DB lookup of what's actually allowed.
// ─────────────────────────────────────────────────────────────────────────

export async function validateVariantAttributes(
  productId: string,
  attributeValues: Record<string, string | number>
): Promise<void> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { categoryId: true },
  });
  if (!product) {
    throw new AppError("PRODUCT_NOT_FOUND");
  }

  const definitions = await getCategoryAttributes(product.categoryId);
  const definedKeys = new Set(definitions.map((d) => d.key));

  // Reject unknown keys — prevents arbitrary JSON injection into variants.
  for (const key of Object.keys(attributeValues)) {
    if (!definedKeys.has(key)) {
      throw new AppError("VALIDATION_ERROR", {
        attributeValues: `"${key}" is not a valid attribute for this product's category.`,
      });
    }
  }

  // Check required attributes are present, and select/color values are
  // within the allowed option list.
  for (const def of definitions) {
    const value = attributeValues[def.key];

    if (def.isRequired && (value === undefined || value === null || value === "")) {
      throw new AppError("VALIDATION_ERROR", {
        attributeValues: `"${def.name}" is required.`,
      });
    }

    if (value === undefined) continue;

    if (def.type === "select") {
      const allowed = (def.options as string[]) ?? [];
      if (!allowed.includes(String(value))) {
        throw new AppError("VALIDATION_ERROR", {
          attributeValues: `"${value}" is not a valid option for "${def.name}". Allowed: ${allowed.join(", ")}`,
        });
      }
    }

    if (def.type === "color") {
      const allowed = (def.options as { name: string; hex: string }[]) ?? [];
      const allowedNames = allowed.map((o) => o.name);
      if (!allowedNames.includes(String(value))) {
        throw new AppError("VALIDATION_ERROR", {
          attributeValues: `"${value}" is not a valid color for "${def.name}". Allowed: ${allowedNames.join(", ")}`,
        });
      }
    }

    if (def.type === "number" && typeof value !== "number") {
      throw new AppError("VALIDATION_ERROR", {
        attributeValues: `"${def.name}" must be a number.`,
      });
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Variant CRUD
// ─────────────────────────────────────────────────────────────────────────

export async function getVariantsByProduct(productId: string) {
  return prisma.productVariant.findMany({
    where: { productId, isActive: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function variantSkuExists(sku: string): Promise<boolean> {
  const existing = await prisma.productVariant.findUnique({ where: { sku } });
  return !!existing;
}

export async function createVariant(data: CreateVariantInput) {
  // Validate attributeValues against the category's schema before writing.
  await validateVariantAttributes(data.productId, data.attributeValues);

  if (await variantSkuExists(data.sku)) {
    throw new AppError("VALIDATION_ERROR", { sku: "This SKU is already in use." });
  }

  return prisma.productVariant.create({
    data: {
      productId: data.productId,
      name: data.name,
      sku: data.sku,
      price: data.price ?? null,
      stockQty: data.stockQty,
      lowStockThreshold: data.lowStockThreshold,
      weightGrams: data.weightGrams ?? null,
      attributeValues: data.attributeValues,
      isActive: data.isActive,
    },
  });
}

export async function updateVariant(
  id: string,
  data: Partial<CreateVariantInput>
) {
  const existing = await prisma.productVariant.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError("VALIDATION_ERROR", { id: "Variant not found." });
  }

  if (data.attributeValues) {
    await validateVariantAttributes(
      data.productId ?? existing.productId,
      data.attributeValues
    );
  }

  if (data.sku && data.sku !== existing.sku && (await variantSkuExists(data.sku))) {
    throw new AppError("VALIDATION_ERROR", { sku: "This SKU is already in use." });
  }

  return prisma.productVariant.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.sku !== undefined && { sku: data.sku }),
      ...(data.price !== undefined && { price: data.price }),
      ...(data.stockQty !== undefined && { stockQty: data.stockQty }),
      ...(data.lowStockThreshold !== undefined && { lowStockThreshold: data.lowStockThreshold }),
      ...(data.weightGrams !== undefined && { weightGrams: data.weightGrams }),
      ...(data.attributeValues !== undefined && { attributeValues: data.attributeValues }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
  });
}

export async function deleteVariant(id: string) {
  return prisma.productVariant.update({
    where: { id },
    data: { isActive: false }, // soft delete — preserves order history integrity
  });
}

/**
 * Decrements stock on a SPECIFIC variant, transactionally — mirrors the
 * race-condition-safe pattern already used for plain product stock.
 */
export async function decrementVariantStock(variantId: string, quantity: number) {
  return prisma.$transaction(async (tx) => {
    const variant = await tx.productVariant.findUnique({
      where: { id: variantId },
      select: { stockQty: true },
    });

    if (!variant) throw new AppError("VALIDATION_ERROR", { variantId: "Variant not found." });
    if (variant.stockQty < quantity) throw new AppError("CART_ITEM_EXCEEDS_STOCK");

    return tx.productVariant.update({
      where: { id: variantId },
      data: { stockQty: { decrement: quantity } },
    });
  });
}
