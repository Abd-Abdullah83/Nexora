import type { Metadata } from "next";
import "./globals.css";
import { CartProvider } from "@/components/cart/CartProvider";
import { ChatBot } from "@/components/chat/ChatBot";

export const metadata: Metadata = {
  title: "Nexora",
  description: "Home Decor, Clothing, Skin Care & Electronics — curated and secure.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen font-body">
        {/*
          CartProvider wraps everything so that:
          1. SWR is configured globally for all hooks
          2. CartDrawer is mounted once at the root (not per-page)
          3. Zustand store is accessible from any component
        */}
        <CartProvider>
          {children}
        </CartProvider>

        {/*
          Mounted here (root layout), not the (storefront) route-group
          layout, because the homepage lives at app/page.tsx — a sibling
          of (storefront), not nested inside it. ChatBot hides itself on
          /admin and auth routes via usePathname() internally, so this is
          safe to mount globally.
        */}
        <ChatBot />
      </body>
    </html>
  );
}