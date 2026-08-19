"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useCartStore } from "@/lib/store/cartStore";
import { useCart } from "@/hooks/useCart";
import { CartItem } from "@/components/cart/CartItem";

export function CartDrawer() {
  const { isOpen, closeCart } = useCartStore();
  const { items, totalItems, subtotal, isLoading, clearCart } = useCart();

  // Close on Escape key
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeCart();
    }
    if (isOpen) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, closeCart]);

  // Block body scroll while drawer is open
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={closeCart}
        className={`fixed inset-0 z-40 bg-charcoal/40 backdrop-blur-sm transition-opacity duration-300 ${isOpen ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
      />

      {/* Drawer panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Shopping cart"
        className={`fixed inset-y-0 right-0 z-50 flex h-full w-full max-w-md flex-col bg-ivory shadow-2xl transition-transform duration-300 ease-in-out ${isOpen ? "translate-x-0" : "translate-x-full"
          }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-ivoryBorder bg-white px-5 py-4">
          <div>
            <h2 className="font-display text-base text-charcoal">
              Shopping Cart
            </h2>
            {totalItems > 0 && (
              <p className="text-xs text-muted">{totalItems} item{totalItems !== 1 ? "s" : ""}</p>
            )}
          </div>
          <div className="flex items-center gap-4">
            {totalItems > 0 && (
              <button
                onClick={clearCart}
                className="text-xs text-muted transition hover:text-red-500"
              >
                Clear all
              </button>
            )}
            <button
              onClick={closeCart}
              aria-label="Close cart"
              className="flex h-8 w-8 items-center justify-center text-muted transition hover:text-charcoal"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
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
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex flex-col gap-4 p-5">
              {[1, 2].map((i) => (
                <div key={i} className="flex gap-3 animate-pulse">
                  <div className="h-20 w-20 flex-shrink-0 rounded-sm bg-ivoryDark" />
                  <div className="flex-1">
                    <div className="mb-2 h-3 w-3/4 rounded bg-ivoryDark" />
                    <div className="h-3 w-1/2 rounded bg-ivoryDark" />
                  </div>
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-16 px-5 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-ivoryDark">
                <svg className="h-10 w-10 text-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>
              <div>
                <p className="font-display text-base text-charcoal">Your cart is empty</p>
                <p className="mt-1 text-sm text-muted">Add items to get started</p>
              </div>
              <Link
                href="/"
                onClick={closeCart}
                className="mt-2 rounded-sm bg-gold px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-goldDark"
              >
                Continue Shopping
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-ivoryBorder px-5">
              {items.map((item) => (
                <CartItem key={`${item.productId}-${item.variantId ?? ""}`} item={item} />
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-ivoryBorder bg-white p-5">
            {/* Subtotal */}
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm text-muted">Subtotal</span>
              <span className="font-semibold text-charcoal">
                PKR {subtotal.toFixed(2)}
              </span>
            </div>
            <p className="mb-4 text-xs text-subtle">
              Shipping and taxes calculated at checkout
            </p>

            {/* Checkout button */}
            <Link
              href="/checkout"
              onClick={closeCart}
              className="block w-full rounded-sm bg-charcoal py-3 text-center text-sm font-semibold text-white transition hover:bg-gold"
            >
              Proceed to Checkout
            </Link>
            <Link
              href="/"
              onClick={closeCart}
              className="mt-2 block text-center text-xs text-muted transition hover:text-gold"
            >
              Continue Shopping
            </Link>
          </div>
        )}
      </div>
    </>
  );
}