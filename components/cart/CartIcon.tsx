"use client";

import { useCartStore } from "@/lib/store/cartStore";

export function CartIcon() {
  const { totalItems, toggleCart } = useCartStore();
  const count = totalItems();

  return (
    <button
      onClick={toggleCart}
      aria-label={
        count > 0 ? `Open cart — ${count} item${count !== 1 ? "s" : ""}` : "Open cart"
      }
      className="relative flex h-9 w-9 items-center justify-center text-muted transition hover:text-gold"
    >
      {/* Shopping bag icon */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.75}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
        />
      </svg>

      {/* Count badge */}
      {count > 0 && (
        <span
          aria-hidden="true"
          className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-gold text-[10px] font-bold text-white"
        >
          {count > 99 ? "99" : count}
        </span>
      )}
    </button>
  );
}