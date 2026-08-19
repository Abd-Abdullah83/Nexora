// FILE: ~/Documents/EcomProject/components/storefront/SubcategoryGrid.tsx

import Link from "next/link";
import Image from "next/image";
import { CategoryNode } from "@/lib/repositories/category.repository";

interface SubcategoryGridProps {
  categories: CategoryNode[];
  /** Base URL prefix, default "/products" */
  basePath?: string;
}

/**
 * Renders a horizontal chip row (≤ 6 items) or a small grid (> 6 items)
 * of direct sub-categories under the current category page.
 *
 * Used on category pages to let users drill deeper, e.g.:
 *   Electronics → [Computers] [Mobile Phones] [Cameras]
 */
export function SubcategoryGrid({
  categories,
  basePath = "/products",
}: SubcategoryGridProps) {
  if (categories.length === 0) return null;

  const useChips = categories.length <= 6;

  if (useChips) {
    return (
      <div className="mt-6 flex flex-wrap gap-2">
        {categories.map((cat) => (
          <Link
            key={cat.id}
            href={`${basePath}/${cat.slug}`}
            className="flex items-center gap-2 rounded-sm border border-white/10 bg-surface px-3 py-1.5 text-xs text-slate transition hover:border-brass/40 hover:text-cream"
          >
            {cat.imageUrl && (
              <span className="relative h-4 w-4 overflow-hidden rounded-sm">
                <Image
                  src={cat.imageUrl}
                  alt={cat.name}
                  fill
                  className="object-cover"
                  sizes="16px"
                />
              </span>
            )}
            {cat.name}
            {cat.productCount > 0 && (
              <span className="text-[10px] text-white/30">
                ({cat.productCount})
              </span>
            )}
          </Link>
        ))}
      </div>
    );
  }

  // Grid layout for larger sets
  return (
    <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {categories.map((cat) => (
        <Link
          key={cat.id}
          href={`${basePath}/${cat.slug}`}
          className="group flex flex-col items-center gap-2 rounded-sm border border-white/[0.06] bg-surface p-3 text-center transition hover:border-brass/30"
        >
          {cat.imageUrl ? (
            <div className="relative h-12 w-12 overflow-hidden rounded-sm">
              <Image
                src={cat.imageUrl}
                alt={cat.name}
                fill
                className="object-cover transition group-hover:scale-105"
                sizes="48px"
              />
            </div>
          ) : (
            // Fallback placeholder
            <div className="flex h-12 w-12 items-center justify-center rounded-sm bg-white/[0.04] text-xl">
              📁
            </div>
          )}
          <span className="text-xs text-slate transition group-hover:text-cream">
            {cat.name}
          </span>
          {cat.productCount > 0 && (
            <span className="text-[10px] text-white/25">{cat.productCount}</span>
          )}
        </Link>
      ))}
    </div>
  );
}
