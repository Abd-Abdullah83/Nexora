import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { getActiveListingsForStore } from "@/lib/sellers/listings.service";
import { StorefrontHeader } from "@/components/storefront/StorefrontHeader";
import { Footer } from "@/components/storefront/Footer";
import { ProductCard } from "@/components/storefront/ProductCard";
import { MessageSellerButton } from "@/components/storefront/MessageSellerButton";

export const revalidate = 60;

interface PageProps {
  params: { slug: string };
  searchParams: { page?: string };
}

export default async function PublicStorePage({ params, searchParams }: PageProps) {
  const store = await prisma.store.findUnique({
    where: { slug: params.slug },
    include: {
      seller: {
        select: {
          id: true,
          status: true,
          displayName: true,
        },
      },
    },
  });

  if (!store || store.seller.status !== "active") notFound();

  const page = searchParams.page ? Number(searchParams.page) : 1;
  const { products, total, pageSize } = await getActiveListingsForStore(store.sellerId, { page, pageSize: 24 });

  const totalPages = Math.ceil(total / pageSize);
  const avgRating = store.avgRating ? Number(store.avgRating) : null;
  const reviewCount = store.reviewCount ?? 0;

  return (
    <div className="min-h-screen bg-ivory">
      <StorefrontHeader />

      {/* Store header */}
      <div className="border-b border-ivoryBorder bg-white">
        {store.bannerUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={store.bannerUrl} alt={`${store.name} banner`} className="h-40 w-full object-cover" />
        )}
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <div className="flex items-start gap-4">
            {store.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={store.logoUrl} alt={`${store.name} logo`} className="h-16 w-16 rounded-full border border-ivoryBorder object-cover" />
            )}
            <div className="flex-1">
              <h1 className="font-display text-2xl text-charcoal">{store.name}</h1>
              {store.description && <p className="mt-1 text-sm text-muted">{store.description}</p>}

              {/* Rating */}
              <div className="mt-2 flex flex-wrap items-center gap-4">
                {avgRating !== null && reviewCount > 0 ? (
                  <div className="flex items-center gap-1.5">
                    <div className="flex text-gold">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <span key={s} className={s <= Math.round(avgRating) ? "text-gold" : "text-ivoryBorder"}>★</span>
                      ))}
                    </div>
                    <span className="text-sm text-charcoal font-medium">{avgRating.toFixed(1)}</span>
                    <span className="text-sm text-muted">({reviewCount} review{reviewCount !== 1 ? "s" : ""})</span>
                  </div>
                ) : (
                  <span className="text-sm text-muted">No reviews yet</span>
                )}
                <span className="text-sm text-muted">{total} product{total !== 1 ? "s" : ""}</span>
              </div>
            </div>

            {/* Message seller button */}
            <MessageSellerButton sellerId={store.sellerId} orderId={null} />
          </div>
        </div>
      </div>

      {/* Products */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {products.length === 0 ? (
          <div className="rounded-sm border border-ivoryBorder bg-white py-16 text-center">
            <p className="text-sm text-muted">No products listed yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                id={product.id}
                slug={product.slug}
                name={product.name}
                price={Number(product.price)}
                comparePrice={product.comparePrice ? Number(product.comparePrice) : null}
                salePrice={(product as any).salePrice ? Number((product as any).salePrice) : null}
                currency={(product as any).currency || "PKR"}
                imageUrl={product.images[0]?.url}
                stockQty={product.stockQty}
              />
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-10 flex items-center justify-center gap-1.5">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <Link
                key={p}
                href={`/store/${params.slug}?page=${p}`}
                className={`flex h-9 w-9 items-center justify-center rounded-sm text-sm transition ${
                  p === page ? "bg-gold text-white" : "border border-ivoryBorder bg-white text-charcoal hover:border-gold"
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
