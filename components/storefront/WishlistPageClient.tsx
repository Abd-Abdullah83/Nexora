"use client";

import { useEffect, useState } from "react";
import { ProductCard } from "@/components/storefront/ProductCard";

interface WishlistProduct {
  id: string;
  slug: string;
  name: string;
  price: number;
  comparePrice: number | null;
  salePrice: number | null;
  saleEndsAt: string | null;
  currency: string;
  stockQty: number;
  images: { url: string }[];
}

export function WishlistPageClient() {
  const [products, setProducts] = useState<WishlistProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/wishlist");
        const data = await res.json();

        if (!res.ok || !data.items?.length) {
          setLoading(false);
          return;
        }

        // Product data is now embedded directly in each wishlist item
        const prods = data.items
          .map((item: any) => item.product)
          .filter(Boolean);

        setProducts(prods);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <p className="mt-8 text-sm text-slate">Loading...</p>;

  if (products.length === 0) {
    return (
      <div className="mt-8 rounded-sm border border-white/[0.08] bg-surface p-10 text-center">
        <p className="text-sm text-slate">Your wishlist is empty.</p>
        <a href="/" className="mt-3 inline-block text-sm text-brass hover:underline">
          Continue shopping
        </a>
      </div>
    );
  }

  return (
    <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          id={product.id}
          slug={product.slug}
          name={product.name}
          price={product.price}
          comparePrice={product.comparePrice}
          salePrice={product.salePrice}
          saleEndsAt={product.saleEndsAt}
          currency={product.currency || "PKR"}
          imageUrl={product.images[0]?.url}
          stockQty={product.stockQty ?? 1}
        />
      ))}
    </div>
  );
}