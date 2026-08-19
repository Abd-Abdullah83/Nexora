"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/hooks/useCart";
import type { CartLineItem } from "@/lib/store/cartStore";

export function CartItem({ item }: { item: CartLineItem }) {
  const { updateItem, removeItem } = useCart();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function changeQty(newQty: number) {
    setError(null);
    setBusy(true);
    if (newQty < 1) {
      const r = await removeItem(item.productId, item.variantId);
      if (!r.success) setError(r.error ?? null);
    } else {
      const r = await updateItem(item.productId, newQty, item.variantId);
      if (!r.success) setError(r.error ?? null);
    }
    setBusy(false);
  }

  async function handleRemove() {
    setError(null);
    setBusy(true);
    const r = await removeItem(item.productId, item.variantId);
    if (!r.success) setError(r.error ?? null);
    setBusy(false);
  }

  return (
    <li
      className={`flex gap-3 py-4 transition-opacity ${busy ? "pointer-events-none opacity-50" : ""
        }`}
    >
      {/* Thumbnail */}
      <Link
        href={`/product/${item.slug}`}
        tabIndex={-1}
        className="flex-shrink-0 overflow-hidden rounded-sm border border-ivoryBorder bg-ivoryDark"
      >
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            alt={item.name}
            className="h-[72px] w-[72px] object-cover"
          />
        ) : (
          <div className="flex h-[72px] w-[72px] items-center justify-center text-xs text-subtle">
            No image
          </div>
        )}
      </Link>

      {/* Details */}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        {/* Name + remove */}
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/product/${item.slug}`}
            className="line-clamp-2 text-sm text-charcoal hover:text-gold transition"
          >
            {item.name}
          </Link>
          <button
            onClick={handleRemove}
            aria-label={`Remove ${item.name}`}
            className="mt-0.5 flex-shrink-0 text-muted hover:text-red-500 transition"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {/* Variant — e.g. "Medium / Red" */}
        {item.variantName && (
          <p className="text-xs text-muted">{item.variantName}</p>
        )}

        {/* Sale badge + countdown */}
        {item.onSale && (
          <div className="flex flex-wrap items-center gap-2">
            {item.discountPercent !== null && (
              <span className="rounded-sm bg-red-100 px-1.5 py-0.5 text-[11px] font-semibold text-red-700">
                -{item.discountPercent}% OFF
              </span>
            )}
            {item.saleEndsAt && <SaleCountdown endsAt={item.saleEndsAt} />}
          </div>
        )}

        {/* Qty stepper + line total */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center rounded-sm border border-ivoryBorder">
            <button
              onClick={() => changeQty(item.quantity - 1)}
              aria-label="Decrease quantity"
              disabled={busy}
              className="flex h-7 w-7 items-center justify-center text-muted hover:text-charcoal transition"
            >
              −
            </button>
            <span className="w-6 text-center text-sm text-charcoal tabular-nums">
              {item.quantity}
            </span>
            <button
              onClick={() => changeQty(item.quantity + 1)}
              aria-label="Increase quantity"
              disabled={busy || item.quantity >= item.stockQty}
              className="flex h-7 w-7 items-center justify-center text-muted hover:text-charcoal transition disabled:opacity-30 disabled:cursor-not-allowed"
            >
              +
            </button>
          </div>
          <div className="flex flex-col items-end">
            {item.onSale && (
              <span className="text-xs text-subtle line-through tabular-nums">
                {item.currency} {(item.originalPrice * item.quantity).toFixed(2)}
              </span>
            )}
            <span className="text-sm font-semibold text-gold tabular-nums">
              {item.currency} {(item.price * item.quantity).toFixed(2)}
            </span>
          </div>
        </div>
        {/* Warnings */}
        {item.unavailable && (
          <p className="text-xs text-red-400">This item is no longer available.</p>
        )}
        {!item.unavailable && item.quantity >= item.stockQty && (
          <p className="text-xs text-amber-400">
            Max available: {item.stockQty}
          </p>
        )}
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    </li>
  );
}
function SaleCountdown({ endsAt }: { endsAt: string }) {
  const end = new Date(endsAt).getTime();
  const now = Date.now();
  const msLeft = end - now;

  if (msLeft <= 0) return null;

  const hoursLeft = msLeft / (1000 * 60 * 60);

  // Only show urgency countdown inside 48h, matching ProductCard's behavior.
  if (hoursLeft > 48) return null;

  const hours = Math.floor(hoursLeft);
  const minutes = Math.floor((msLeft % (1000 * 60 * 60)) / (1000 * 60));

  return (
    <span className="rounded-sm border border-red-400/30 px-1.5 py-0.5 text-[11px] text-red-400/90 tabular-nums">
      Ends in {hours}h {minutes}m
    </span>
  );
}