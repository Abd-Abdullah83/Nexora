import { notFound } from "next/navigation";
import Link from "next/link";
import { getProductBySlug } from "@/lib/repositories/product.repository";
import { getProductRatingSummary } from "@/lib/repositories/review.repository";
import { getCategoryAttributes, getVariantsByProduct } from "@/lib/repositories/variant.repository";
import { getCategoryBreadcrumb, getActiveCategories } from "@/lib/repositories/category.repository";
import { StorefrontHeader } from "@/components/storefront/StorefrontHeader";
import { Footer } from "@/components/storefront/Footer";
import { ProductGallery } from "@/components/storefront/ProductGallery";
import { ProductVariantSection } from "@/components/storefront/ProductVariantSection";
import { AddToCartButton } from "@/components/cart/AddToCartButton";
import { WishlistButton } from "@/components/storefront/WishlistButton";
import { getEffectivePrice } from "@/lib/utils/pricing";
import { MessageSellerButton } from "@/components/storefront/MessageSellerButton";
import { ReviewSection } from "@/components/storefront/ReviewSection";

interface PageProps {
  params: { slug: string };
}

export default async function ProductDetailPage({ params }: PageProps) {
  const product = await getProductBySlug(params.slug);
  if (!product) notFound();

  const currency = (product as any).currency ?? "PKR";

  const [rating, attributeDefsRaw, variants, breadcrumb, allCategories] = await Promise.all([
    getProductRatingSummary(product.id),
    getCategoryAttributes(product.categoryId),
    getVariantsByProduct(product.id),
    getCategoryBreadcrumb(product.categoryId),
    getActiveCategories(),
  ]);

  const rootCategories = allCategories.filter((c: any) => (c.level ?? 0) === 0);

  const attributeDefs = attributeDefsRaw.map((def) => ({
    id: def.id,
    name: def.name,
    key: def.key,
    type: def.type,
    options: def.options as string[] | { name: string; hex: string }[],
    unit: def.unit,
  }));

  const serializedVariants = variants.map((v) => ({
    id: v.id,
    name: v.name,
    sku: v.sku,
    price: v.price ? v.price.toString() : null,
    stockQty: v.stockQty,
    weightGrams: v.weightGrams,
    attributeValues: v.attributeValues as Record<string, string | number>,
    isActive: v.isActive,
  }));

  const pricing = getEffectivePrice({
    price: Number(product.price),
    comparePrice: product.comparePrice ? Number(product.comparePrice) : null,
    salePrice: (product as any).salePrice ? Number((product as any).salePrice) : null,
    saleEndsAt: (product as any).saleEndsAt ?? null,
  });

  const inStock = product.stockQty > 0;

  return (
    <div className="min-h-screen bg-ivory">
      <StorefrontHeader />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">

        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-1.5 text-xs text-muted">
          <Link href="/" className="hover:text-gold transition">Home</Link>
          {breadcrumb.map((crumb) => (
            <span key={crumb.id} className="flex items-center gap-1.5">
              <span className="text-ivoryBorder">/</span>
              <Link href={`/products/${crumb.slug}`} className="hover:text-gold transition">
                {crumb.name}
              </Link>
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span className="text-ivoryBorder">/</span>
            <span className="text-charcoal font-medium">{product.name}</span>
          </span>
        </nav>

        <div className="grid gap-8 md:grid-cols-2 lg:gap-12">

          {/* Gallery */}
          <div className="rounded-sm overflow-hidden border border-ivoryBorder bg-white">
            <ProductGallery
              images={product.images}
              productName={product.name}
              videoUrl={(product as any).videoUrl ?? null}
            />
          </div>

          {/* Details */}
          <div className="flex flex-col gap-5">
            {/* Category tag */}
            <div>
              <span className="rounded-full border border-gold/30 bg-gold/5 px-3 py-1 text-xs font-medium text-gold uppercase tracking-wide">
                {product.category.name}
              </span>
            </div>
{/* Sold by — links to the seller's public store page */}
{product.seller?.store && !product.seller.isSystemSeller && (
  <Link
    href={`/store/${product.seller.store.slug}`}
    className="flex items-center gap-1.5 text-xs text-muted hover:text-gold transition w-fit"
  >
    <span>Sold by</span>
    <span className="font-medium text-charcoal">
      {product.seller.store.name}
    </span>

    {product.seller.store.avgRating && (
      <span className="flex items-center gap-0.5 text-gold">
        ★ {Number(product.seller.store.avgRating).toFixed(1)}
      </span>
    )}

    <span className="text-gold">→</span>
  </Link>
)}
            {/* Name */}
            <h1 className="font-display text-2xl leading-tight text-charcoal sm:text-3xl">
              {product.name}
            </h1>

            {/* Rating */}
            {rating.reviewCount > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex text-gold">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <span key={star} className={star <= Math.round(rating.averageRating) ? "text-gold" : "text-ivoryBorder"}>
                      ★
                    </span>
                  ))}
                </div>
                <span className="text-sm text-muted">
                  {rating.averageRating.toFixed(1)} ({rating.reviewCount} review{rating.reviewCount !== 1 ? "s" : ""})
                </span>
              </div>
            )}

            {/* Divider */}
            <div className="h-px bg-ivoryBorder" />

            {/* Price */}
            <div className="flex flex-wrap items-baseline gap-3">
              <span className={`text-3xl font-bold ${pricing.onSale ? "text-red-600" : "text-charcoal"}`}>
                {currency} {pricing.effectivePrice.toFixed(2)}
              </span>
              {pricing.strikethroughPrice && (
                <span className="text-lg text-muted line-through">
                  {currency} {pricing.strikethroughPrice.toFixed(2)}
                </span>
              )}
              {pricing.onSale && pricing.discountPercent && (
                <span className="rounded-sm bg-red-100 px-2 py-0.5 text-xs font-bold text-red-600">
                  -{pricing.discountPercent}% OFF
                </span>
              )}
            </div>

            {/* Sale countdown */}
            {pricing.onSale && pricing.saleEndsAt && (() => {
              const msLeft = pricing.saleEndsAt!.getTime() - Date.now();
              const hoursLeft = msLeft / (1000 * 60 * 60);
              if (hoursLeft <= 0 || hoursLeft > 48) return null;
              const h = Math.floor(hoursLeft);
              const m = Math.floor((msLeft % (1000 * 60 * 60)) / (1000 * 60));
              return (
                <div className="flex items-center gap-2 rounded-sm border border-red-200 bg-red-50 px-3 py-2">
                  <span className="text-red-500">⏱</span>
                  <span className="text-sm font-medium text-red-600">
                    Sale ends in {h}h {m}m
                  </span>
                </div>
              );
            })()}

            {/* Stock status */}
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${inStock ? "bg-green-500" : "bg-red-400"}`} />
              <span className={`text-sm font-medium ${inStock ? "text-green-700" : "text-red-600"}`}>
                {inStock ? `In stock (${product.stockQty} available)` : "Out of stock"}
              </span>
            </div>

            {/* Description */}
            {product.shortDescription && (
              <p className="text-sm leading-relaxed text-muted">
                {product.shortDescription}
              </p>
            )}

            {/* Divider */}
            <div className="h-px bg-ivoryBorder" />

            {/* Variant selector or Add to Cart */}
            {attributeDefs.length > 0 && serializedVariants.length > 0 ? (
              <ProductVariantSection
                productId={product.id}
                attributeDefs={attributeDefs}
                variants={serializedVariants}
                fallbackStockQty={product.stockQty}
              />
            ) : (
              <div className="flex flex-col gap-2">
                <AddToCartButton productId={product.id} stockQty={product.stockQty} />
                <WishlistButton productId={product.id} variant="full" />
              </div>
            )}

            {/* Trust badges */}
            <div className="grid grid-cols-3 gap-3 border-t border-ivoryBorder pt-5">
              {[
                { icon: "🚚", label: "Free Delivery", sub: "On orders above PKR 2000" },
                { icon: "↩", label: "Easy Returns", sub: "7-day return policy" },
                { icon: "🔒", label: "Secure Payment", sub: "100% protected" },
              ].map((badge) => (
                <div key={badge.label} className="flex flex-col items-center gap-1 text-center">
                  <span className="text-xl">{badge.icon}</span>
                  <p className="text-[11px] font-semibold text-charcoal">{badge.label}</p>
                  <p className="text-[10px] text-muted leading-tight">{badge.sub}</p>
                </div>
              ))}
            </div>

            {/* Phase 10: Message Seller — shown if product belongs to a real seller */}
            {(product as any).sellerId && (
              <div className="border-t border-ivoryBorder pt-4">
                <p className="mb-2 text-xs text-muted">Have a question about this product?</p>
                <MessageSellerButton sellerId={(product as any).sellerId} />
              </div>
            )}
          </div>
        </div>

        {/* Full description */}
        {product.description && (
          <div className="mt-12 rounded-sm border border-ivoryBorder bg-white p-6">
            <h2 className="mb-4 font-display text-lg text-charcoal">Product Description</h2>
            <p className="text-sm leading-relaxed text-muted whitespace-pre-line">
              {product.description}
            </p>
          </div>
        )}

        {/* Reviews — full ReviewSection with submit/vote/delete, not a
            read-only inline list. This is the fix for "write a review has
            gone" — a static block had replaced this component during the
            ivory redesign, dropping the submit form entirely. */}
        <ReviewSection productId={product.id} productSlug={product.slug} />
      </main>

      <Footer categories={rootCategories} />
    </div>
  );
}