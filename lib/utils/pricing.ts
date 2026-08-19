// ─────────────────────────────────────────────────────────────────────────
// lib/utils/pricing.ts
//
// Shared pricing helpers used by ProductCard, ProductDetailPage, and
// the admin form to calculate the effective (final) price of a product
// after accounting for any active sale.
// ─────────────────────────────────────────────────────────────────────────

export interface PricingInput {
  price: number;
  comparePrice?: number | null;
  salePrice?: number | null;
  saleEndsAt?: string | Date | null;
}

export interface PricingResult {
  effectivePrice: number;       // what the customer actually pays
  originalPrice: number;        // always the base price
  strikethroughPrice: number | null; // the price shown with a line through it
  discountPercent: number | null;    // e.g. 25 for "25% off"
  onSale: boolean;              // true if an active sale is applied
  saleExpired: boolean;         // true if saleEndsAt is in the past
  saleEndsAt: Date | null;      // null if no end date
}

/**
 * Returns the effective price for a product.
 *
 * Priority:
 *  1. salePrice (if set and not expired) → effectivePrice
 *  2. price → effectivePrice
 *
 * strikethroughPrice:
 *  - If on sale: show comparePrice (if higher than base price) else base price
 *  - If not on sale: show comparePrice (if higher than base price)
 */
export function getEffectivePrice(input: PricingInput): PricingResult {
  const price = Number(input.price);
  const comparePrice = input.comparePrice ? Number(input.comparePrice) : null;
  const salePrice = input.salePrice ? Number(input.salePrice) : null;
  const saleEndsAt = input.saleEndsAt ? new Date(input.saleEndsAt) : null;

  const now = new Date();
  const saleExpired = saleEndsAt ? saleEndsAt < now : false;
  const onSale = !!salePrice && salePrice < price && !saleExpired;

  const effectivePrice = onSale ? salePrice! : price;

  let strikethroughPrice: number | null = null;
  if (onSale) {
    // Show original price (or comparePrice if it's higher) as strikethrough
    strikethroughPrice = comparePrice && comparePrice > price ? comparePrice : price;
  } else if (comparePrice && comparePrice > price) {
    // No sale but comparePrice set — show comparePrice as strikethrough
    strikethroughPrice = comparePrice;
  }

  const discountPercent =
    strikethroughPrice && strikethroughPrice > effectivePrice
      ? Math.round(((strikethroughPrice - effectivePrice) / strikethroughPrice) * 100)
      : null;

  return {
    effectivePrice,
    originalPrice: price,
    strikethroughPrice,
    discountPercent,
    onSale,
    saleExpired,
    saleEndsAt,
  };
}
