import Link from "next/link";
import { notFound } from "next/navigation";
import { getProducts } from "@/lib/repositories/product.repository";
import { getCategoryBySlug, getCategoryBreadcrumb, getActiveCategories } from "@/lib/repositories/category.repository";
import { StorefrontHeader } from "@/components/storefront/StorefrontHeader";
import { ProductCard } from "@/components/storefront/ProductCard";
import { Footer } from "@/components/storefront/Footer";
import { SortSelect } from "@/components/storefront/SortSelect";
import { prisma } from "@/lib/db/prisma";

export const revalidate = 60;

interface PageProps {
  params: { category: string };
  searchParams: { page?: string; sort?: string };
}

export default async function CategoryPage({ params, searchParams }: PageProps) {
  const category = await getCategoryBySlug(params.category);
  if (!category) notFound();

  const page = searchParams.page ? Number(searchParams.page) : 1;
  const sort = (searchParams.sort as any) ?? "newest";

  const [result, breadcrumb, subcategories, allCategories] = await Promise.all([
    getProducts({
      categorySlug: params.category,
      page,
      pageSize: 24,
      sort,
    }),
    getCategoryBreadcrumb(category.id),
    prisma.category.findMany({
      where: { parentId: category.id, isActive: true },
      orderBy: { displayOrder: "asc" },
    }),
    getActiveCategories(),
  ]);

  const rootCategories = allCategories.filter((c: any) => (c.level ?? 0) === 0);

  return (
    <div className="min-h-screen bg-ivory">
      <StorefrontHeader />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">

        {/* Breadcrumb */}
        <nav className="mb-5 flex items-center gap-1.5 text-xs text-muted">
          <Link href="/" className="hover:text-gold transition">Home</Link>
          {breadcrumb.map((crumb, i) => (
            <span key={crumb.id} className="flex items-center gap-1.5">
              <span className="text-ivoryBorder">/</span>
              {i === breadcrumb.length - 1 ? (
                <span className="text-charcoal font-medium">{crumb.name}</span>
              ) : (
                <Link href={`/products/${crumb.slug}`} className="hover:text-gold transition">
                  {crumb.name}
                </Link>
              )}
            </span>
          ))}
        </nav>

        {/* Header */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-ivoryBorder pb-5">
          <div>
            <h1 className="font-display text-2xl text-charcoal">{category.name}</h1>
            {category.description && (
              <p className="mt-1 text-sm text-muted">{category.description}</p>
            )}
            <p className="mt-1 text-xs text-subtle">
              {result.total} product{result.total !== 1 ? "s" : ""}
            </p>
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted">Sort by</label>
            <SortSelect sort={sort} />
          </div>
        </div>

        {/* Subcategory pills */}
        {subcategories.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-2">
            <Link
              href={`/products/${params.category}`}
              className="rounded-full border border-gold bg-gold/10 px-4 py-1.5 text-xs font-medium text-goldDark transition hover:bg-gold hover:text-white"
            >
              All {category.name}
            </Link>
            {subcategories.map((sub) => (
              <Link
                key={sub.id}
                href={`/products/${sub.slug}`}
                className="rounded-full border border-ivoryBorder bg-white px-4 py-1.5 text-xs font-medium text-charcoal transition hover:border-gold hover:text-gold"
              >
                {sub.name}
              </Link>
            ))}
          </div>
        )}

        {/* Product grid */}
        {result.items.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {result.items.map((product) => (
              <ProductCard
                key={product.id}
                id={product.id}
                slug={product.slug}
                name={product.name}
                price={Number(product.price)}
                comparePrice={product.comparePrice ? Number(product.comparePrice) : null}
                salePrice={(product as any).salePrice ? Number((product as any).salePrice) : null}
                saleEndsAt={(product as any).saleEndsAt ? new Date((product as any).saleEndsAt).toISOString() : null}
                currency={(product as any).currency || "PKR"}
                imageUrl={product.images[0]?.url}
                stockQty={product.stockQty}
              />
            ))}
          </div>
        ) : (
          <div className="mt-8 rounded-sm border border-ivoryBorder bg-white p-16 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-ivoryDark">
              <svg className="h-8 w-8 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <p className="font-display text-lg text-charcoal">No products yet</p>
            <p className="mt-1 text-sm text-muted">Check back soon or explore other categories.</p>
            <Link href="/" className="mt-4 inline-block rounded-sm bg-gold px-5 py-2.5 text-sm font-semibold text-white hover:bg-goldDark transition">
              Continue Shopping
            </Link>
          </div>
        )}

        {/* Pagination */}
        {result.totalPages > 1 && (
          <div className="mt-10 flex items-center justify-center gap-1.5">
            {page > 1 && (
              <Link
                href={`/products/${params.category}?page=${page - 1}&sort=${sort}`}
                className="flex h-9 w-9 items-center justify-center rounded-sm border border-ivoryBorder bg-white text-sm text-charcoal hover:border-gold hover:text-gold transition"
              >
                ‹
              </Link>
            )}
            {Array.from({ length: result.totalPages }, (_, i) => i + 1).map((p) => (
              <Link
                key={p}
                href={`/products/${params.category}?page=${p}&sort=${sort}`}
                className={`flex h-9 w-9 items-center justify-center rounded-sm text-sm transition ${p === page
                  ? "bg-gold text-white font-semibold border border-gold"
                  : "border border-ivoryBorder bg-white text-charcoal hover:border-gold hover:text-gold"
                  }`}
              >
                {p}
              </Link>
            ))}
            {page < result.totalPages && (
              <Link
                href={`/products/${params.category}?page=${page + 1}&sort=${sort}`}
                className="flex h-9 w-9 items-center justify-center rounded-sm border border-ivoryBorder bg-white text-sm text-charcoal hover:border-gold hover:text-gold transition"
              >
                ›
              </Link>
            )}
          </div>
        )}
      </main>

      <Footer categories={rootCategories} />
    </div>
  );
}