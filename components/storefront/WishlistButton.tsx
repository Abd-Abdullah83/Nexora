"use client";

import { useState, useEffect } from "react";

interface WishlistButtonProps {
  productId: string;
  /** Pass true if you already know it's wishlisted (e.g. from server) */
  initialWishlisted?: boolean;
  /** "icon" = just the heart, "full" = heart + label, default "icon" */
  variant?: "icon" | "full";
}

function getCsrf(): string {
  return (
    document.cookie
      .split("; ")
      .find((c) => c.startsWith("csrf_token="))
      ?.split("=")[1] ?? ""
  );
}

export function WishlistButton({
  productId,
  initialWishlisted = false,
  variant = "icon",
}: WishlistButtonProps) {
  const [wishlisted, setWishlisted] = useState(initialWishlisted);
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false); // has the server been queried?

  // On mount, check real wishlist state from server
  useEffect(() => {
    fetch("/api/wishlist")
      .then((r) => r.json())
      .then((data) => {
        const ids: string[] = (data.items ?? []).map((i: { productId: string }) => i.productId);
        setWishlisted(ids.includes(productId));
        setChecked(true);
      })
      .catch(() => setChecked(true));
  }, [productId]);

  async function toggle() {
    if (loading) return;
    setLoading(true);

    const next = !wishlisted;
    setWishlisted(next); // optimistic

    try {
      const res = await fetch("/api/wishlist", {
        method: next ? "POST" : "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": getCsrf(),
        },
        body: JSON.stringify({ productId }),
      });

      if (!res.ok) {
        setWishlisted(!next); // rollback
      }
    } catch {
      setWishlisted(!next); // rollback
    } finally {
      setLoading(false);
    }
  }

  if (variant === "full") {
    return (
      <button
        onClick={toggle}
        disabled={loading || !checked}
        className={`flex items-center gap-2 rounded-sm border px-4 py-2.5 text-sm font-medium transition ${wishlisted
            ? "border-red-400/40 bg-red-400/10 text-red-400 hover:bg-red-400/20"
            : "border-white/10 text-slate hover:border-brass/40 hover:text-cream"
          } disabled:opacity-40`}
        aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
      >
        <Heart filled={wishlisted} />
        {wishlisted ? "Wishlisted" : "Add to Wishlist"}
      </button>
    );
  }

  // Default: icon only
  return (
    <button
      onClick={toggle}
      disabled={loading || !checked}
      className={`flex h-9 w-9 items-center justify-center rounded-full border transition ${wishlisted
          ? "border-red-400/40 bg-red-400/10 text-red-400"
          : "border-white/10 text-slate/50 hover:border-brass/30 hover:text-brass"
        } disabled:opacity-40`}
      aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
    >
      <Heart filled={wishlisted} />
    </button>
  );
}

function Heart({ filled }: { filled: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 1.5}
      className="h-4 w-4"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z"
      />
    </svg>
  );
}
