import { create } from "zustand";

export interface CartLineItem {
  id: string;
  productId: string;
  variantId: string | null;
  variantName: string | null;
  variantAttributes: Record<string, string | number> | null;
  name: string;
  slug: string;
  price: number;              // effective price — already sale-adjusted by the API
  originalPrice: number;
  discountPercent: number | null;
  onSale: boolean;
  saleEndsAt: string | null;
  currency: string;
  imageUrl: string | null;
  quantity: number;
  stockQty: number;
  weightGrams: number | null;
  unavailable: boolean;
}

interface CartState {
  items: CartLineItem[];
  isOpen: boolean;

  // Drawer controls
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;

  // Called after every server response to overwrite local state
  syncFromServer: (items: CartLineItem[]) => void;

  // Optimistic helpers — instant UI before server responds. Matched on
  // (productId, variantId) together — a bare productId match would
  // incorrectly touch every variant of the same product at once.
  optimisticUpdate: (productId: string, variantId: string | null, quantity: number) => void;
  optimisticRemove: (productId: string, variantId: string | null) => void;

  // Derived values
  totalItems: () => number;
  subtotal: () => number;
}

function sameLine(item: CartLineItem, productId: string, variantId: string | null) {
  return item.productId === productId && item.variantId === variantId;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  isOpen: false,

  openCart: () => set({ isOpen: true }),
  closeCart: () => set({ isOpen: false }),
  toggleCart: () => set((s) => ({ isOpen: !s.isOpen })),

  syncFromServer: (items) => set({ items }),

  optimisticUpdate: (productId, variantId, quantity) =>
    set((s) => ({
      items: s.items.map((i) =>
        sameLine(i, productId, variantId) ? { ...i, quantity } : i
      ),
    })),

  optimisticRemove: (productId, variantId) =>
    set((s) => ({
      items: s.items.filter((i) => !sameLine(i, productId, variantId)),
    })),

  totalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
  subtotal: () =>
    get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),
}));
