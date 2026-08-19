// FILE: ~/Documents/EcomProject/components/storefront/CategoryBreadcrumb.tsx

import Link from "next/link";
import { getCategoryBreadcrumb } from "@/lib/repositories/category.repository";

interface CategoryBreadcrumbProps {
  categoryId: string;
  /** Extra crumbs appended after the category chain, e.g. a product name. */
  append?: { label: string; href?: string }[];
}

/**
 * Renders a full ancestor chain:
 *   Home / Electronics / Computers / Laptops
 *
 * Each segment links to /products/<slug> except the last one, which is
 * rendered as plain text (current page).
 */
export async function CategoryBreadcrumb({
  categoryId,
  append = [],
}: CategoryBreadcrumbProps) {
  const crumbs = await getCategoryBreadcrumb(categoryId);

  type Crumb =
    | { label: string; href: string; key: string }
    | { label: string; href?: undefined; key: string };

  const segments: Crumb[] = [
    { label: "Home", href: "/", key: "home" },
    ...crumbs.map((c) => ({
      label: c.name,
      href: `/products/${c.slug}`,
      key: c.id,
    })),
    ...append.map((a, i) => ({
      label: a.label,
      href: a.href,
      key: `append-${i}`,
    })),
  ];

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex flex-wrap items-center gap-1 text-xs text-slate"
    >
      {segments.map((seg, idx) => {
        const isLast = idx === segments.length - 1;

        return (
          <span key={seg.key} className="flex items-center gap-1">
            {idx > 0 && <span className="text-white/20">/</span>}

            {isLast || !seg.href ? (
              <span className={isLast ? "text-cream" : undefined}>
                {seg.label}
              </span>
            ) : (
              <Link
                href={seg.href}
                className="transition hover:text-brass"
              >
                {seg.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
