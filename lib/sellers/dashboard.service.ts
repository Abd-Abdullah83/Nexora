// ─────────────────────────────────────────────────────────────────────────
// lib/sellers/dashboard.service.ts
//
// Per the Phase 4 scope note: "later phases add data sources this page
// surfaces, but the page itself is scaffolded here." store/subscription
// sections are real now. sales/pendingOrders/wallet are placeholder zeros
// with a `available` flag — Phase 6 (orders) and Phase 7 (wallet) extend
// THIS SAME function rather than creating parallel dashboard endpoints,
// per the API Contract note in the scaling doc.
// ─────────────────────────────────────────────────────────────────────────

import { prisma } from "@/lib/db/prisma";
import { getStoreForSeller } from "@/lib/sellers/store.service";
import { getSubscriptionForSeller } from "@/lib/sellers/billing.service";

export async function getSellerDashboard(sellerId: string) {
  const [store, subscription] = await Promise.all([
    getStoreForSeller(sellerId),
    getSubscriptionForSeller(sellerId),
  ]);

  return {
    store,
    subscription,
    // Scaffolded — wired up in later phases, not this one.
    sales: { available: false, totalRevenue: 0, ordersCount: 0, periodLabel: "Last 30 days" },
    pendingOrders: { available: false, count: 0 },
    wallet: { available: false, balance: 0, currency: "USD" },
    notifications: { available: false, items: [] as { message: string; createdAt: string }[] },
  };
}
