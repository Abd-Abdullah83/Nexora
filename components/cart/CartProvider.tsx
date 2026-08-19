"use client";

import { SWRConfig } from "swr";
import { CartDrawer } from "./CartDrawer";

/**
 * CartProvider — goes in app/layout.tsx wrapping {children}.
 * Provides SWR config globally and mounts CartDrawer at the root
 * so it's accessible from every page without re-mounting.
 */
export function CartProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        onError: (err) => {
          if (process.env.NODE_ENV === "development") {
            console.error("[SWR]", err);
          }
        },
      }}
    >
      {children}
      <CartDrawer />
    </SWRConfig>
  );
}
