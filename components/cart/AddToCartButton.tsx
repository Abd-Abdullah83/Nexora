"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/hooks/useCart";

interface AddToCartButtonProps {
  productId: string;
  stockQty: number;
  variantId?: string | null;
  variantRequired?: boolean;
}

export function AddToCartButton({
  productId,
  stockQty,
  variantId = null,
  variantRequired = false,
}: AddToCartButtonProps) {
  const { addItem } = useCart();
  const router = useRouter();
  const [loading, setLoading] = useState<"cart" | "buy" | null>(null);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const outOfStock = stockQty === 0;
  const disabled = outOfStock || variantRequired || loading !== null;

  const blockedLabel = outOfStock
    ? "Out of Stock"
    : variantRequired
      ? "Select Options"
      : null;

  async function handleBuyNow() {
    if (disabled) return;
    setLoading("buy");
    setError(null);
    const result = await addItem(productId, 1, variantId);
    if (result.success) {
      router.push("/checkout");
    } else {
      setError(result.error ?? "Could not process. Please try again.");
      setLoading(null);
    }
  }

  async function handleAddToCart() {
    if (disabled) return;
    setLoading("cart");
    setError(null);
    const result = await addItem(productId, 1, variantId);
    if (result.success) {
      setAdded(true);
      setTimeout(() => setAdded(false), 2500);
    } else {
      setError(result.error ?? "Could not add to cart.");
    }
    setLoading(null);
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Buy It Now — primary action */}
      <button
        onClick={handleBuyNow}
        disabled={disabled}
        className={`w-full rounded-sm py-3 text-sm font-semibold uppercase tracking-wider transition ${blockedLabel
          ? "cursor-not-allowed bg-ivoryDark text-muted"
          : loading === "buy"
            ? "bg-goldDark text-white opacity-80"
            : "bg-charcoal text-white hover:bg-gold"
          } disabled:opacity-50`}
      >
        {loading === "buy" ? "Processing…" : blockedLabel ?? "Buy It Now"}
      </button>

      {/* Add to Cart — secondary action */}
      <button
        onClick={handleAddToCart}
        disabled={disabled}
        className={`w-full rounded-sm border py-3 text-sm font-semibold uppercase tracking-wider transition ${blockedLabel
          ? "cursor-not-allowed border-ivoryBorder text-muted"
          : added
            ? "border-green-400 bg-green-50 text-green-700"
            : loading === "cart"
              ? "border-gold/50 text-gold/60"
              : "border-gold bg-gold text-white hover:bg-goldDark"
          } disabled:opacity-50`}
      >
        {loading === "cart"
          ? "Adding…"
          : added
            ? "✓ Added to Cart!"
            : blockedLabel ?? "Add to Cart"}
      </button>

      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}