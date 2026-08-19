"use client";

import { useState } from "react";
import { AddToCartButton } from "@/components/cart/AddToCartButton";
import { WishlistButton } from "@/components/storefront/WishlistButton";
import { VariantSelector, resolveVariant } from "@/components/storefront/VariantSelector";

interface AttributeDef {
  id: string;
  name: string;
  key: string;
  type: "select" | "color" | "number";
  options: string[] | { name: string; hex: string }[];
  unit?: string | null;
}

interface VariantOption {
  id: string;
  name: string;
  sku: string;
  price: string | null;
  stockQty: number;
  weightGrams: number | null;
  attributeValues: Record<string, string | number>;
  isActive: boolean;
}

export function ProductVariantSection({
  productId,
  attributeDefs,
  variants,
  fallbackStockQty,
}: {
  productId: string;
  attributeDefs: AttributeDef[];
  variants: VariantOption[];
  fallbackStockQty: number;
}) {
  const [selectedValues, setSelectedValues] = useState<Record<string, string>>({});

  const matchedVariant = resolveVariant(variants, attributeDefs, selectedValues);
  const allSelected = attributeDefs.every((d) => selectedValues[d.key]);

  function handleChange(key: string, value: string) {
    setSelectedValues((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="flex flex-col gap-4">
      <VariantSelector
        attributeDefs={attributeDefs}
        variants={variants}
        selectedValues={selectedValues}
        onChange={handleChange}
      />

      {allSelected && !matchedVariant && (
        <p className="text-sm text-amber-400">
          This combination isn&apos;t available. Try a different selection.
        </p>
      )}

      {matchedVariant && matchedVariant.stockQty === 0 && (
        <p className="text-sm text-red-400">This option is out of stock.</p>
      )}

      <AddToCartButton
        productId={productId}
        stockQty={matchedVariant ? matchedVariant.stockQty : fallbackStockQty}
        variantId={matchedVariant?.id ?? null}
        variantRequired={!allSelected || !matchedVariant}
      />
      <WishlistButton productId={productId} variant="full" />
    </div>
  );
}
