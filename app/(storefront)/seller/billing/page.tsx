"use client";

import { useEffect, useState } from "react";
import { SellerLayout } from "@/components/seller/SellerLayout";

interface Subscription {
  plan: "individual" | "business";
  status: "trialing" | "active" | "past_due" | "cancelled";
  trialEndAt: string;
  currentPeriodEnd: string | null;
  pastDueSince: string | null;
}

const PLAN_PRICE: Record<"individual" | "business", string> = {
  individual: "USD 15/month",
  business: "USD 60/month",
};

function daysUntil(dateStr: string): number {
  return Math.max(0, Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000));
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-PK", { day: "numeric", month: "long", year: "numeric" });
}

export default function SellerBillingPage() {
  const [sub, setSub] = useState<Subscription | null>(null);
  const [sellerType, setSellerType] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/sellers/subscription")
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) { setError(json.error?.message ?? "Could not load billing info."); return; }
        setSub(json.subscription);
        setSellerType(json.sellerType);
      })
      .catch(() => setError("Network error."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <SellerLayout>
      <h1 className="font-display text-2xl text-charcoal">Billing</h1>
      <p className="mt-1 text-sm text-muted">Your subscription plan and billing status.</p>

      {loading && <div className="mt-6 h-48 animate-pulse rounded-sm bg-ivoryDark" />}
      {error && <p className="mt-4 rounded-sm border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {sub && (
        <div className="mt-6 flex flex-col gap-4">
          {/* Current plan card */}
          <div className="rounded-sm border border-ivoryBorder bg-white p-6 shadow-card">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted">Current plan</p>
                <p className="mt-1 font-display text-lg text-charcoal capitalize">{sub.plan}</p>
                <p className="text-sm text-muted">{PLAN_PRICE[sub.plan]}</p>
              </div>
              <StatusBadge status={sub.status} />
            </div>

            <div className="mt-4 border-t border-ivoryBorder pt-4">
              {sub.status === "trialing" && (
                <div>
                  <p className="text-sm text-charcoal">
                    Free trial ends <strong>{formatDate(sub.trialEndAt)}</strong>
                    {" "}({daysUntil(sub.trialEndAt)} days remaining)
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    After your trial, your plan renews at {PLAN_PRICE[sub.plan]}.
                    Automatic billing is not yet configured — you'll receive an invoice when the time comes.
                  </p>
                </div>
              )}
              {sub.status === "past_due" && (
                <p className="text-sm text-red-700">
                  Payment is overdue since {sub.pastDueSince ? formatDate(sub.pastDueSince) : "recently"}.
                  Your store will be suspended after the grace period expires.
                  Automatic billing is not yet configured — contact support to settle your account.
                </p>
              )}
              {sub.status === "active" && sub.currentPeriodEnd && (
                <p className="text-sm text-muted">
                  Next billing date: <strong className="text-charcoal">{formatDate(sub.currentPeriodEnd)}</strong>
                </p>
              )}
              {sub.status === "cancelled" && (
                <p className="text-sm text-muted">
                  Your subscription has been cancelled. Contact support to reactivate.
                </p>
              )}
            </div>
          </div>

          {/* Notice: no gateway yet */}
          <div className="rounded-sm border border-gold/30 bg-gold/5 p-4">
            <p className="text-sm font-medium text-charcoal">Automatic payments coming soon</p>
            <p className="mt-1 text-xs text-muted">
              Recurring subscription billing isn't yet configured for this marketplace — invoices
              are tracked manually while this is set up. You'll be notified before any charge
              is attempted.
            </p>
          </div>
        </div>
      )}
    </SellerLayout>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    trialing: "bg-gold/15 text-gold",
    active: "bg-emerald/15 text-emerald",
    past_due: "bg-red-100 text-red-700",
    cancelled: "bg-ivoryDark text-subtle",
  };
  return (
    <span className={`rounded-sm px-2.5 py-1 text-xs font-medium capitalize ${map[status] ?? "bg-ivoryDark text-subtle"}`}>
      {status.replace("_", " ")}
    </span>
  );
}
