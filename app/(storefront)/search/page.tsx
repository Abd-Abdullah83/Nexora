import { getProducts } from "@/lib/repositories/product.repository";
import { StorefrontHeader } from "@/components/storefront/StorefrontHeader";
import { ProductCard } from "@/components/storefront/ProductCard";
import { Pagination } from "@/components/storefront/Pagination";

interface PageProps {
  searchParams: { q?: string; page?: string };
}

export default async function SearchPage({ searchParams }: PageProps) {
  const query = searchParams.q || "";
  const page = searchParams.page ? Number(searchParams.page) : 1;

  const result = query
    ? await getProducts({ searchQuery: query, page, pageSize: 24 })
    : { items: [], total: 0, page: 1, pageSize: 24, totalPages: 0 };

  return (
    <div className="min-h-screen bg-ink">
      <StorefrontHeader />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <h1 className="font-display text-2xl text-cream">
          {query ? `Search results for "${query}"` : "Search"}
        </h1>
        <p className="mt-1 text-sm text-slate">
          {result.total} product{result.total !== 1 ? "s" : ""} found
        </p>

        {query && result.items.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-20 text-center">
            <p className="text-slate">No products matched your search.</p>
            <p className="text-sm text-slate/60">
              Try a different keyword, or browse by category instead.
            </p>
          </div>
        )}

        {result.items.length > 0 && (
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
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
                imageUrl={product.images[0]?.url}
                stockQty={product.stockQty}
              />
            ))}
          </div>
        )}

        <Pagination currentPage={result.page} totalPages={result.totalPages} />
      </main>
    </div>
  );
}