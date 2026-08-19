"use client";

import Link from "next/link";
import { useState } from "react";
import { getEffectivePrice } from "@/lib/utils/pricing";
import { useCart } from "@/hooks/useCart";

interface ProductCardProps {
  id: string;
  slug: string;
  name: string;
  price: number;
  comparePrice?: number | null;
  salePrice?: number | null;
  saleEndsAt?: string | null;
  currency?: string;
  imageUrl?: string | null;
  stockQty: number;
  rating?: number;
  reviewCount?: number;
}

export function ProductCard({
  id,
  slug,
  name,
  price,
  comparePrice,
  salePrice,
  saleEndsAt,
  currency = "PKR",
  imageUrl,
  stockQty,
  rating,
  reviewCount,
}: ProductCardProps) {
  const { addItem } = useCart();
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  const pricing = getEffectivePrice({
    price,
    comparePrice,
    salePrice,
    saleEndsAt,
  });

  const outOfStock = stockQty === 0;

  async function handleAddToCart(e: React.MouseEvent) {
    e.preventDefault();
    if (outOfStock || adding) return;
    setAdding(true);
    const result = await addItem(id, 1);
    if (result.success) {
      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
    }
    setAdding(false);
  }

  return (
    <Link
      href={`/product/${slug}`}
      className="group flex flex-col bg-white rounded-sm border border-ivoryBorder shadow-card hover:shadow-cardHover transition-all duration-300 overflow-hidden"
    >
      {/* Image */}
      <div className="relative aspect-square overflow-hidden bg-ivoryDark">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <svg className="h-12 w-12 text-ivoryBorder" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}

        {/* Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {pricing.onSale && pricing.discountPercent && (
            <span className="rounded-sm bg-red-500 px-2 py-0.5 text-[11px] font-bold text-white">
              -{pricing.discountPercent}% OFF
            </span>
          )}
          {stockQty > 0 && stockQty <= 5 && !pricing.onSale && (
            <span className="rounded-sm bg-amber-500 px-2 py-0.5 text-[11px] font-bold text-white">
              Only {stockQty} left
            </span>
          )}
          {outOfStock && (
            <span className="rounded-sm bg-charcoal/70 px-2 py-0.5 text-[11px] font-bold text-white">
              Sold Out
            </span>
          )}
        </div>

        {/* Quick add button — appears on hover */}
        {!outOfStock && (
          <div className="absolute bottom-0 left-0 right-0 translate-y-full transition-transform duration-300 group-hover:translate-y-0">
            <button
              onClick={handleAddToCart}
              disabled={adding}
              className={`w-full py-2.5 text-xs font-semibold uppercase tracking-wider transition ${added
                  ? "bg-green-600 text-white"
                  : "bg-charcoal text-white hover:bg-gold"
                }`}
            >
              {adding ? "Adding…" : added ? "✓ Added!" : "Add to Cart"}
            </button>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <p className="line-clamp-2 text-sm font-medium text-charcoal leading-snug group-hover:text-gold transition-colors">
          {name}
        </p>

        {/* Rating */}
        {rating !== undefined && rating > 0 && (
          <div className="flex items-center gap-1">
            <div className="flex text-gold text-xs">
              {[1, 2, 3, 4, 5].map((star) => (
                <span key={star} className={star <= Math.round(rating) ? "text-gold" : "text-ivoryBorder"}>
                  ★
                </span>
              ))}
            </div>
            {reviewCount !== undefined && reviewCount > 0 && (
              <span className="text-[11px] text-muted">({reviewCount})</span>
            )}
          </div>
        )}

        {/* Price */}
        <div className="mt-auto flex flex-wrap items-center gap-2">
          <span className={`text-sm font-bold ${pricing.onSale ? "text-red-600" : "text-charcoal"}`}>
            {currency} {pricing.effectivePrice.toFixed(2)}
          </span>
          {pricing.strikethroughPrice && (
            <span className="text-xs text-muted line-through">
              {currency} {pricing.strikethroughPrice.toFixed(2)}
            </span>
          )}
        </div>

        {/* Sale countdown */}
        {pricing.onSale && pricing.saleEndsAt && (() => {
          const msLeft = pricing.saleEndsAt!.getTime() - Date.now();
          const hoursLeft = msLeft / (1000 * 60 * 60);
          if (hoursLeft <= 0 || hoursLeft > 48) return null;
          const h = Math.floor(hoursLeft);
          const m = Math.floor((msLeft % (1000 * 60 * 60)) / (1000 * 60));
          return (
            <p className="text-[11px] text-red-500 font-medium">
              ⏱ {h}h {m}m left
            </p>
          );
        })()}

        {outOfStock && (
          <p className="text-[11px] text-muted">Out of stock</p>
        )}
      </div>
    </Link>
  );
}
