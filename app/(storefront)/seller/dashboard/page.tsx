"use client";

import { useEffect, useState } from "react";
import { SellerLayout } from "@/components/seller/SellerLayout";
import Link from "next/link";

interface DashboardData {
  store: { id: string; name: string; slug: string } | null;
  subscription: {
    plan: string;
    status: string;
    trialEndAt: string;
    currentPeriodEnd: string | null;
  } | null;
  sales: { available: boolean; totalRevenue: number; ordersCount: number; periodLabel: string };
  pendingOrders: { available: boolean; count: number };
  wallet: { available: boolean; balance: number; currency: string };
}

function daysUntil(dateStr: string): number {
  return Math.max(0, Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000));
}

export default function SellerDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/sellers/dashboard")
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) { setError(json.error?.message ?? "Could not load dashboard."); return; }
        setData(json);
      })
      .catch(() => setError("Network error."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <SellerLayout>
      <div className="mb-6">
        <h1 className="font-display text-2xl text-charcoal">Dashboard</h1>
        <p className="mt-1 text-sm text-muted">Here's what's happening with your store.</p>
      </div>

      {loading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-md bg-ivoryDark" />
          ))}
        </div>
      )}

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>
      )}

      {data && (
        <div className="flex flex-col gap-6">
          {/* Subscription banner */}
          {data.subscription && (
            <div
              className={`rounded-md border p-4 transition-colors duration-150 ${
                data.subscription.status === "trialing"
                  ? "border-gold/25 bg-gold/[0.04]"
                  : data.subscription.status === "past_due"
                  ? "border-red-200 bg-red-50"
                  : "border-ivoryBorder bg-white"
              }`}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${
                      data.subscription.status === "past_due" ? "bg-red-100 text-red-600" : "bg-gold/10 text-gold"
                    }`}
                  >
                    <IconCrown className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-medium capitalize text-charcoal">
                      {data.subscription.plan} plan — {data.subscription.status.replace("_", " ")}
                    </p>
                    {data.subscription.status === "trialing" && (
                      <p className="mt-0.5 text-xs text-muted">
                        {daysUntil(data.subscription.trialEndAt)} days left in free trial
                      </p>
                    )}
                    {data.subscription.status === "past_due" && (
                      <p className="mt-0.5 text-xs text-red-600">
                        Payment is overdue — update billing to avoid suspension.
                      </p>
                    )}
                  </div>
                </div>
                <Link
                  href="/seller/billing"
                  className="flex-shrink-0 rounded-sm px-3 py-1.5 text-xs font-medium text-gold transition-colors duration-150 hover:bg-gold/10"
                >
                  View billing →
                </Link>
              </div>
            </div>
          )}

          {/* Stats grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              icon={IconBanknote}
              label="Revenue (last 30d)"
              value={data.sales.available ? `PKR ${data.sales.totalRevenue.toLocaleString()}` : "—"}
              sub={data.sales.available ? `${data.sales.ordersCount} orders` : "Available once you have sales"}
              href="/seller/orders"
              comingSoon={!data.sales.available}
              tint="emerald"
            />
            <StatCard
              icon={IconReceipt}
              label="Pending orders"
              value={data.pendingOrders.available ? String(data.pendingOrders.count) : "—"}
              sub={data.pendingOrders.available ? "Needs action" : "Available once orders come in"}
              href="/seller/orders"
              comingSoon={!data.pendingOrders.available}
              tint="amber"
            />
            <StatCard
              icon={IconWallet}
              label="Wallet balance"
              value={data.wallet.available ? `${data.wallet.currency} ${data.wallet.balance.toFixed(2)}` : "—"}
              sub={data.wallet.available ? "Available to withdraw" : "Available once you have payouts"}
              href="/seller/wallet"
              comingSoon={!data.wallet.available}
              tint="gold"
            />
          </div>

          {/* Store quick link */}
          {data.store ? (
            <div className="group rounded-md border border-ivoryBorder bg-white p-4 transition-all duration-150 hover:border-gold/30 hover:shadow-card">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-ivory text-charcoal">
                    <IconStorefront className="h-4.5 w-4.5" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-charcoal">{data.store.name}</p>
                    <p className="mt-0.5 text-xs text-muted">nexora.com/store/{data.store.slug}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Link
                    href="/seller/store"
                    className="rounded-sm px-3 py-1.5 text-xs font-medium text-gold transition-colors duration-150 hover:bg-gold/10"
                  >
                    Edit store
                  </Link>
                  <Link
                    href={`/store/${data.store.slug}`}
                    target="_blank"
                    className="rounded-sm px-3 py-1.5 text-xs font-medium text-muted transition-colors duration-150 hover:bg-ivoryDark hover:text-charcoal"
                  >
                    View public page
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-ivoryBorder bg-white/50 p-8 text-center">
              <p className="text-sm text-muted">Your store page is being set up.</p>
            </div>
          )}
        </div>
      )}
    </SellerLayout>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  href,
  comingSoon,
  tint,
}: {
  icon: (props: { className?: string }) => JSX.Element;
  label: string;
  value: string;
  sub: string;
  href?: string;
  comingSoon?: boolean;
  tint: "emerald" | "amber" | "gold";
}) {
  const tintClasses = {
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    gold: "bg-gold/10 text-gold",
  }[tint];

  const card = (
    <div
      className={`group rounded-md border p-4 transition-all duration-150 ${
        comingSoon
          ? "border-dashed border-ivoryBorder bg-white/50"
          : "border-ivoryBorder bg-white hover:-translate-y-0.5 hover:border-gold/20 hover:shadow-card"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className={`flex h-9 w-9 items-center justify-center rounded-full ${comingSoon ? "bg-ivoryDark text-subtle" : tintClasses}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 text-xs text-muted">{label}</p>
      <p className={`mt-0.5 text-xl font-semibold ${comingSoon ? "text-subtle" : "text-charcoal"}`}>{value}</p>
      <p className="mt-0.5 text-xs text-subtle">{sub}</p>
      {href && !comingSoon && (
        <span className="mt-2 inline-block text-xs font-medium text-gold opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          View →
        </span>
      )}
    </div>
  );

  return href && !comingSoon ? <Link href={href}>{card}</Link> : card;
}

function IconBanknote({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2" /><path d="M6 12h.01M18 12h.01" />
    </svg>
  );
}
function IconReceipt({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 2h16v20l-3-2-2 2-3-2-2 2-3-2-3 2Z" /><path d="M8 7h8M8 11h8M8 15h5" />
    </svg>
  );
}
function IconWallet({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-1" /><path d="M21 12a2 2 0 0 0-2-2h-2a2 2 0 0 0 0 4h2a2 2 0 0 0 2-2Z" />
    </svg>
  );
}
function IconCrown({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7Z" /><path d="M5 19h14" />
    </svg>
  );
}
function IconStorefront({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 7h20l-1.5 5.5a2 2 0 0 1-2 1.5H5.5a2 2 0 0 1-2-1.5Z" /><path d="M4 13v6a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-6" /><path d="M9 21v-5h6v5" />
    </svg>
  );
}
