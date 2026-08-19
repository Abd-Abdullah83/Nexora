"use client";

import useSWR from "swr";
import { useCartStore, CartLineItem } from "@/lib/store/cartStore";

// ── CSRF helper ────────────────────────────────────────────────────────────
function getCsrf(): string {
  return (
    document.cookie
      .split("; ")
      .find((c) => c.startsWith("csrf_token="))
      ?.split("=")[1] ?? ""
  );
}

async function fetchCart(url: string) {
  const res = await fetch(url);
  if (res.status === 401) return { items: [] }; // Not logged in — empty cart
  if (!res.ok) throw new Error("Failed to fetch cart");
  return res.json();
}

export function useCart() {
  const store = useCartStore();

  const { mutate, isLoading } = useSWR<{ items: CartLineItem[] }>(
    "/api/cart",
    fetchCart,
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      onSuccess: (data) => {
        store.syncFromServer(data.items ?? []);
      },
    }
  );

  // ── Add 1 of a product (optionally a specific variant) ────────────────
  async function addItem(
    productId: string,
    quantity = 1,
    variantId?: string | null
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": getCsrf(),
        },
        body: JSON.stringify({ productId, quantity, variantId: variantId ?? null }),
      });
      const json = await res.json();
      if (!res.ok) {
        await mutate();
        return { success: false, error: json.error?.message ?? "Could not add item." };
      }
      store.syncFromServer(json.items);
      store.openCart();
      return { success: true };
    } catch {
      await mutate();
      return { success: false, error: "Network error. Please try again." };
    }
  }

  // ── Set exact quantity (qty stepper) ───────────────────────────────────
  async function updateItem(
    productId: string,
    quantity: number,
    variantId: string | null = null
  ): Promise<{ success: boolean; error?: string }> {
    const snapshot = store.items;
    store.optimisticUpdate(productId, variantId, quantity);
    try {
      const res = await fetch("/api/cart", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": getCsrf(),
        },
        body: JSON.stringify({ productId, quantity, variantId }),
      });
      const json = await res.json();
      if (!res.ok) {
        store.syncFromServer(snapshot);
        return { success: false, error: json.error?.message ?? "Could not update." };
      }
      store.syncFromServer(json.items);
      return { success: true };
    } catch {
      store.syncFromServer(snapshot);
      return { success: false, error: "Network error." };
    }
  }

  // ── Remove one item ────────────────────────────────────────────────────
  async function removeItem(
    productId: string,
    variantId: string | null = null
  ): Promise<{ success: boolean; error?: string }> {
    const snapshot = store.items;
    store.optimisticRemove(productId, variantId);
    try {
      const res = await fetch("/api/cart", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": getCsrf(),
        },
        body: JSON.stringify({ productId, variantId }),
      });
      const json = await res.json();
      if (!res.ok) {
        store.syncFromServer(snapshot);
        return { success: false, error: json.error?.message ?? "Could not remove." };
      }
      store.syncFromServer(json.items);
      return { success: true };
    } catch {
      store.syncFromServer(snapshot);
      return { success: false, error: "Network error." };
    }
  }

  // ── Clear entire cart ──────────────────────────────────────────────────
  async function clearCart(): Promise<{ success: boolean; error?: string }> {
    const snapshot = store.items;
    store.syncFromServer([]);
    try {
      const res = await fetch("/api/cart", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": getCsrf(),
        },
        body: JSON.stringify({ clearAll: true }),
      });
      if (!res.ok) {
        store.syncFromServer(snapshot);
        return { success: false, error: "Could not clear cart." };
      }
      return { success: true };
    } catch {
      store.syncFromServer(snapshot);
      return { success: false, error: "Network error." };
    }
  }

  return {
    items: store.items,
    totalItems: store.totalItems(),
    subtotal: store.subtotal(),
    isLoading,
    addItem,
    updateItem,
    removeItem,
    clearCart,
  };
}