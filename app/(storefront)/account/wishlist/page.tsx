import { StorefrontHeader } from "@/components/storefront/StorefrontHeader";
import { WishlistPageClient } from "@/components/storefront/WishlistPageClient";

export default function WishlistPage() {
  return (
    <div className="min-h-screen bg-ink">
      <StorefrontHeader />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <h1 className="font-display text-2xl text-cream">My Wishlist</h1>
        <WishlistPageClient />
      </main>
    </div>
  );
}