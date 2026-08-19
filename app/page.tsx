import Link from "next/link";
import { getProducts } from "@/lib/repositories/product.repository";
import { getActiveCategories } from "@/lib/repositories/category.repository";
import { StorefrontHeader } from "@/components/storefront/StorefrontHeader";
import { ProductCard } from "@/components/storefront/ProductCard";
import { Footer } from "@/components/storefront/Footer";
import { HeroSlider } from "@/components/storefront/HeroSlider";
import { CategoryScroll } from "@/components/storefront/CategoryScroll";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HomePage() {
  const [featured, newArrivals, categories] = await Promise.all([
    getProducts({ isFeatured: true, pageSize: 8 }),
    getProducts({ isNewArrival: true, pageSize: 8 }),
    getActiveCategories(),
  ]);

  // Only root-level categories for homepage
  const rootCategories = categories.filter((c: any) => (c.level ?? 0) === 0);

  return (
    <div className="min-h-screen bg-ivory">
      <StorefrontHeader />

      {/* ── Hero Slider ── */}
      <HeroSlider categories={rootCategories} />

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">

        {/* ── Category Scroll ── */}
        <section className="mb-12">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-display text-xl text-charcoal">Shop by Category</h2>
            <Link href="/products" className="text-sm text-gold hover:text-goldDark transition">
              View all →
            </Link>
          </div>
          <CategoryScroll categories={rootCategories} />
        </section>

        {/* ── Featured Products ── */}
        {featured.items.length > 0 && (
          <section className="mb-14">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="font-display text-xl text-charcoal">Featured Products</h2>
                <p className="mt-1 text-sm text-muted">Handpicked by our team</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {featured.items.map((product) => (
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
          </section>
        )}

        {/* ── Promotional banner ── */}
        <section className="mb-14 overflow-hidden rounded-lg bg-charcoal px-8 py-12 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-gold mb-3">Limited Time</p>
          <h2 className="font-display text-2xl text-white sm:text-3xl mb-4">
            Premium Quality, Delivered to Your Door
          </h2>
          <p className="text-sm text-white/60 mb-6 max-w-md mx-auto">
            Free delivery on all orders over PKR 2,000. Shop now and experience the Nexora difference.
          </p>
          <Link
            href="/products"
            className="inline-block rounded-sm bg-gold px-8 py-3 text-sm font-semibold text-white transition hover:bg-goldDark"
          >
            Shop Now
          </Link>
        </section>

        {/* ── New Arrivals ── */}
        {newArrivals.items.length > 0 && (
          <section className="mb-14">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="font-display text-xl text-charcoal">New Arrivals</h2>
                <p className="mt-1 text-sm text-muted">Fresh additions to our store</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {newArrivals.items.map((product) => (
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
          </section>
        )}

        {/* ── Trust badges ── */}
        <section className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { icon: "🚚", title: "Free Delivery", desc: "On orders over PKR 2,000" },
            { icon: "🔒", title: "Secure Payment", desc: "100% secure transactions" },
            { icon: "↩️", title: "Easy Returns", desc: "30-day return policy" },
            { icon: "🎧", title: "24/7 Support", desc: "Always here to help" },
          ].map((b) => (
            <div key={b.title} className="flex items-center gap-3 rounded-lg border border-ivoryBorder bg-white p-4">
              <span className="text-2xl">{b.icon}</span>
              <div>
                <p className="text-sm font-semibold text-charcoal">{b.title}</p>
                <p className="text-xs text-muted">{b.desc}</p>
              </div>
            </div>
          ))}
        </section>

      </main>

      <Footer categories={rootCategories} />
    </div>
  );
}
