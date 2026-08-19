import Link from "next/link";
import { getProducts } from "@/lib/repositories/product.repository";
import { StorefrontHeader } from "@/components/storefront/StorefrontHeader";
import { ProductCard } from "@/components/storefront/ProductCard";
import { Footer } from "@/components/storefront/Footer";

export const revalidate = 60;

interface PageProps {
  searchParams: { page?: string; sort?: string };
}

const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "name_asc", label: "Name A–Z" },
];

export default async function AllProductsPage({ searchParams }: PageProps) {
  const page = searchParams.page ? Number(searchParams.page) : 1;
  const sort = (searchParams.sort as any) ?? "newest";

  const result = await getProducts({ page, pageSize: 24, sort });

  return (
    <div className="min-h-screen bg-ivory">
      <StorefrontHeader />

      <div className="border-b border-ivoryBorder bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <nav className="mb-2 text-xs text-muted">
            <Link href="/" className="hover:text-gold transition">Home</Link>
            <span className="mx-2 text-ivoryBorder">/</span>
            <span className="text-charcoal">All Products</span>
          </nav>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-display text-3xl text-charcoal">All Products</h1>
              <p className="mt-1 text-sm text-muted">{result.total} products available</p>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted">Sort by</label>
              <select
                defaultValue={sort}
                onChange={(e) => {
                  const url = new URL(window.location.href);
                  url.searchParams.set("sort", e.target.value);
                  url.searchParams.delete("page");
                  window.location.href = url.toString();
                }}
                className="rounded-sm border border-ivoryBorder bg-white px-3 py-1.5 text-sm text-charcoal outline-none focus:border-gold"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
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
          <div className="py-20 text-center">
            <p className="font-display text-lg text-charcoal">No products yet</p>
            <p className="mt-1 text-sm text-muted">Check back soon.</p>
          </div>
        )}

        {result.totalPages > 1 && (
          <div className="mt-10 flex items-center justify-center gap-1.5">
            {Array.from({ length: result.totalPages }, (_, i) => i + 1).map((p) => (
              <Link
                key={p}
                href={`/products?page=${p}&sort=${sort}`}
                className={`flex h-9 w-9 items-center justify-center rounded-sm text-sm transition ${
                  p === page
                    ? "bg-gold text-white font-semibold border border-gold"
                    : "border border-ivoryBorder bg-white text-charcoal hover:border-gold hover:text-gold"
                }`}
              >
                {p}
              </Link>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
