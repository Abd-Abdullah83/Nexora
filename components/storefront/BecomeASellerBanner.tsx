"use client";

import Link from "next/link";

/**
 * "Become a Seller" entry point — per the Phase 2 scaling doc's UI
 * requirement: "entry point on the existing buyer account/profile page."
 *
 * I don't have your current account page file, so I can't safely insert
 * this for you without risking overwriting whatever's already there.
 * Drop this component into your account page yourself — e.g.:
 *
 *   import { BecomeASellerBanner } from "@/components/storefront/BecomeASellerBanner";
 *   // ...inside the page, near the top of the account dashboard content:
 *   <BecomeASellerBanner />
 *
 * Only show this to users who are still plain buyers — once someone has
 * applied, role becomes seller_individual/seller_business, so a simple
 * `{user.role === "customer" && <BecomeASellerBanner />}` in the account
 * page is enough; this component doesn't gate itself, since it doesn't
 * have access to session data on its own.
 */
export function BecomeASellerBanner() {
  return (
    <div className="flex flex-col items-start justify-between gap-4 rounded-sm border border-gold/30 bg-gold/5 p-5 sm:flex-row sm:items-center">
      <div>
        <p className="font-display text-base text-charcoal">Sell on Nexora</p>
        <p className="mt-1 text-sm text-muted">
          Open your own store on Nexora's Premium Marketplace. Takes about 5 minutes to apply.
        </p>
      </div>
      <Link
        href="/seller/apply"
        className="flex-shrink-0 rounded-sm bg-gold px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-goldDark"
      >
        Become a Seller
      </Link>
    </div>
  );
}
