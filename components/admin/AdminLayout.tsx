"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { label: "Dashboard",     href: "/admin/dashboard" },
  { label: "Products",      href: "/admin/products" },
  { label: "Categories",    href: "/admin/categories" },
  { label: "Category Requests", href: "/admin/category-requests" },
  { label: "Orders",        href: "/admin/orders" },
  { label: "Customers",     href: "/admin/customers" },
  { label: "Sellers",       href: "/admin/sellers" },
  { label: "Verifications", href: "/admin/verifications" },
  { label: "Listings",      href: "/admin/listings" },
  { label: "Escrow",        href: "/admin/escrow" },
  { label: "Disputes",      href: "/admin/disputes" },
  { label: "Payouts",       href: "/admin/payouts" },
  { label: "Commission",    href: "/admin/commission" },
  { label: "Overrides",     href: "/admin/overrides" },
  { label: "Audit Log",     href: "/admin/audit-log" },
  { label: "Ban Alerts",    href: "/admin/ban-evasion-alerts" },
  { label: "Reviews",       href: "/admin/reviews" },
  { label: "Inventory",     href: "/admin/inventory" },
  { label: "Coupons",       href: "/admin/coupons" },
  { label: "Analytics",     href: "/admin/analytics" },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const [openDisputes, setOpenDisputes] = useState<number | null>(null);
  const [pendingPayouts, setPendingPayouts] = useState<number | null>(null);
  const [pendingBanAlerts, setPendingBanAlerts] = useState<number | null>(null);
  const [pendingCategoryRequests, setPendingCategoryRequests] = useState<number | null>(null);

  useEffect(() => {
    // Disputes — red badge, needs urgent admin attention
    fetch("/api/admin/disputes?status=admin_review&page=1&pageSize=1")
      .then(async (res) => {
        if (!res.ok) return;
        const json = await res.json();
        if (typeof json?.total === "number") setOpenDisputes(json.total);
      })
      .catch(() => {});

    // Pending payouts — brass badge
    fetch("/api/admin/payouts?status=pending&page=1&pageSize=1")
      .then(async (res) => {
        if (!res.ok) return;
        const json = await res.json();
        if (typeof json?.total === "number") setPendingPayouts(json.total);
      })
      .catch(() => {});

    // Ban evasion alerts — red badge
    fetch("/api/admin/ban-evasion-alerts?page=1&pageSize=1")
      .then(async (res) => {
        if (!res.ok) return;
        const json = await res.json();
        if (typeof json?.total === "number") setPendingBanAlerts(json.total);
      })
      .catch(() => {});

    // Category requests — brass badge
    fetch("/api/admin/category-requests?status=pending&page=1&pageSize=1")
      .then(async (res) => {
        if (!res.ok) return;
        const json = await res.json();
        if (typeof json?.total === "number") setPendingCategoryRequests(json.total);
      })
      .catch(() => {});
  }, []);

  return (
    <aside className="hidden w-56 flex-col border-r border-white/10 bg-surface p-5 sm:flex">
      <div className="mb-8 flex items-center gap-2.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-full border border-brass/40 font-display text-xs italic text-brass">
          N
        </span>
        <span className="font-display text-xs uppercase tracking-[0.2em] text-cream">
          Nexora Admin
        </span>
      </div>

      <nav className="flex flex-col gap-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between rounded-sm px-3 py-2 text-sm transition ${
                active
                  ? "bg-brass/10 text-brass font-medium"
                  : "text-cream/70 hover:bg-white/[0.06] hover:text-brass"
              }`}
            >
              {item.label}

              {/* Red badge — disputes needing urgent review */}
              {item.href === "/admin/disputes" &&
                !!openDisputes &&
                openDisputes > 0 && (
                  <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-semibold text-red-300">
                    {openDisputes}
                  </span>
                )}

              {/* Brass badge — pending payouts */}
              {item.href === "/admin/payouts" &&
                !!pendingPayouts &&
                pendingPayouts > 0 && (
                  <span className="rounded-full bg-brass/20 px-2 py-0.5 text-xs font-semibold text-brass">
                    {pendingPayouts}
                  </span>
                )}

              {/* Red badge — ban evasion alerts */}
              {item.href === "/admin/ban-evasion-alerts" &&
                !!pendingBanAlerts &&
                pendingBanAlerts > 0 && (
                  <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-semibold text-red-300">
                    {pendingBanAlerts}
                  </span>
                )}

              {/* Brass badge — pending category requests */}
              {item.href === "/admin/category-requests" &&
                !!pendingCategoryRequests &&
                pendingCategoryRequests > 0 && (
                  <span className="rounded-full bg-brass/20 px-2 py-0.5 text-xs font-semibold text-brass">
                    {pendingCategoryRequests}
                  </span>
                )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-white/10 pt-4">
        <Link
          href="/"
          className="block rounded-sm px-3 py-2 text-xs text-slate transition hover:text-cream"
        >
          Back to Store
        </Link>
      </div>
    </aside>
  );
}

export function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-ink">
      <AdminSidebar />
      <div className="flex-1 p-6 sm:p-8">{children}</div>
    </div>
  );
}