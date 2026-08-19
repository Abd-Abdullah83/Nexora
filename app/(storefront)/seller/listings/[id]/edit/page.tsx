"use client";

// app/(storefront)/seller/listings/[id]/edit/page.tsx
//
// FIX: added saleEndsAt to the ListingDetail interface and the `initial`
// prop passed to ListingForm — previously it was fetched from the API
// (the field was always there, Prisma returns it as a plain scalar) but
// silently dropped since nothing in this page read or passed it through.
// Uses the same datetime-local conversion pattern as the admin edit page
// (`new Date(...).toISOString().slice(0, 16)`) so the picker pre-fills
// correctly when editing an existing sale.

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { SellerLayout } from "@/components/seller/SellerLayout";
import { ListingForm } from "@/components/seller/ListingForm";

interface ListingDetail {
  id: string;
  name: string;
  description: string;
  shortDescription: string | null;
  price: number;
  comparePrice: number | null;
  salePrice: number | null;
  saleEndsAt: string | null; // NEW
  categoryId: string;
  sku: string | null;
  stockQty: number;
  weightGrams: number | null;
  status: "draft" | "active" | "archived";
  tags: string[];
  currency: string;
  videoUrl: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  images: { id: string; url: string; altText: string | null; isPrimary: boolean }[];
}

export default function EditListingPage() {
  const { id } = useParams<{ id: string }>();
  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/sellers/listings/${id}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) { setError(json.error?.message ?? "Could not load listing."); return; }
        setListing(json.product);
      })
      .catch(() => setError("Network error."))
      .finally(() => setLoading(false));
  }, [id]);

  // NEW: convert saleEndsAt (ISO string from API) to the format the
  // datetime-local input expects — same pattern as admin's edit page.
  const saleEndsAtForInput = listing?.saleEndsAt
    ? new Date(listing.saleEndsAt).toISOString().slice(0, 16)
    : "";

  return (
    <SellerLayout>
      <div className="mb-6">
        <Link href="/seller/listings" className="inline-flex items-center gap-1 text-xs text-muted transition-colors duration-150 hover:text-gold">
          ← Back to listings
        </Link>
        <h1 className="mt-2 font-display text-2xl text-charcoal">
          {listing ? `Edit: ${listing.name}` : "Edit listing"}
        </h1>
      </div>

      {loading && (
        <div className="space-y-4">
          <div className="h-48 animate-pulse rounded-md bg-ivoryDark" />
          <div className="h-32 animate-pulse rounded-md bg-ivoryDark" />
        </div>
      )}

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>
      )}

      {listing && (
        <>
          {/* Existing images */}
          {listing.images.length > 0 && (
            <div className="mb-6 rounded-md border border-ivoryBorder bg-white p-4 shadow-card">
              <p className="mb-3 text-sm font-medium text-charcoal">Current images</p>
              <div className="flex flex-wrap gap-3">
                {listing.images.map((img) => (
                  <div key={img.id} className="group relative transition-transform duration-150 hover:-translate-y-0.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.url}
                      alt={img.altText ?? "Product image"}
                      className="h-20 w-20 rounded-md border border-ivoryBorder object-cover transition-shadow duration-150 group-hover:shadow-card"
                    />
                    {img.isPrimary && (
                      <span className="absolute bottom-0 left-0 right-0 rounded-b-md bg-gold/85 px-1 py-0.5 text-center text-[10px] text-white">
                        Primary
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-subtle">
                To add more images, save your changes first, then re-open this listing.
              </p>
            </div>
          )}

          <ListingForm
            mode="edit"
            listingId={listing.id}
            initial={{
              name: listing.name,
              description: listing.description,
              shortDescription: listing.shortDescription ?? "",
              price: String(listing.price),
              comparePrice: listing.comparePrice != null ? String(listing.comparePrice) : "",
              salePrice: listing.salePrice != null ? String(listing.salePrice) : "",
              saleEndsAt: saleEndsAtForInput, // NEW
              categoryId: listing.categoryId,
              sku: listing.sku ?? "",
              stockQty: String(listing.stockQty),
              weightGrams: listing.weightGrams != null ? String(listing.weightGrams) : "",
              status: listing.status,
              tags: listing.tags.join(", "),
              currency: listing.currency,
              videoUrl: listing.videoUrl ?? "",
              metaTitle: listing.metaTitle ?? "",
              metaDescription: listing.metaDescription ?? "",
            }}
          />
        </>
      )}
    </SellerLayout>
  );
}
