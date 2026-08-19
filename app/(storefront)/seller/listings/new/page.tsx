"use client";

import { SellerLayout } from "@/components/seller/SellerLayout";
import { ListingForm } from "@/components/seller/ListingForm";
import Link from "next/link";

export default function NewListingPage() {
  return (
    <SellerLayout>
      <div className="mb-6">
        <Link href="/seller/listings" className="inline-flex items-center gap-1 text-xs text-muted transition-colors duration-150 hover:text-gold">
          ← Back to listings
        </Link>
        <h1 className="mt-2 font-display text-2xl text-charcoal">New listing</h1>
        <p className="mt-1 text-sm text-muted">
          Save as draft first, then set to Active when ready to sell.
        </p>
      </div>

      <ListingForm mode="create" />
    </SellerLayout>
  );
}
