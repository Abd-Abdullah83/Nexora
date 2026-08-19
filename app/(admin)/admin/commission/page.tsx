"use client";

import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";

interface CommissionRate {
  id: string;
  sellerType: "individual" | "business";
  ratePercent: number;
  effectiveFrom: string;
  effectiveTo: string | null;
}

interface CommissionData {
  individual: CommissionRate | null;
  business: CommissionRate | null;
}

function getCsrf(): string {
  return document.cookie.split("; ").find((c) => c.startsWith("csrf_token="))?.split("=")[1] ?? "";
}

function RateCard({
  sellerType,
  current,
  onUpdate,
}: {
  sellerType: "individual" | "business";
  current: CommissionRate | null;
  onUpdate: (sellerType: "individual" | "business", rate: number) => Promise<void>;
}) {
  const [newRate, setNewRate] = useState(current ? String(current.ratePercent) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSave() {
    const rate = Number(newRate);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      setError("Rate must be between 0 and 100.");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await onUpdate(sellerType, rate);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message ?? "Failed to update.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-sm border border-white/[0.08] bg-surface p-5">
      <h3 className="mb-1 text-sm font-semibold capitalize text-cream">
        {sellerType} sellers
      </h3>
      <p className="mb-4 text-xs text-slate">
        Applied to all commission calculations for {sellerType} seller accounts.
      </p>

      {current ? (
        <div className="mb-4 rounded-sm border border-white/[0.06] bg-ink/30 px-3 py-2 text-sm">
          <p className="text-slate text-xs mb-1">Current rate</p>
          <p className="text-2xl font-bold text-brass">{current.ratePercent}%</p>
          <p className="mt-1 text-xs text-slate/60">
            Active since {new Date(current.effectiveFrom).toLocaleDateString("en-PK")}
          </p>
        </div>
      ) : (
        <div className="mb-4 rounded-sm border border-white/[0.06] bg-ink/30 px-3 py-2 text-sm text-slate">
          No rate configured yet — set one below.
        </div>
      )}

      <div className="flex items-center gap-2">
        <div className="relative">
          <input
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={newRate}
            onChange={(e) => setNewRate(e.target.value)}
            placeholder={current ? String(current.ratePercent) : "e.g. 5"}
            className="w-28 rounded-sm border border-white/10 bg-ink/40 px-3 py-2 pr-6 text-sm text-cream outline-none focus:border-brass/50"
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-slate">%</span>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !newRate}
          className="rounded-sm bg-brass px-4 py-2 text-sm font-semibold text-ink transition hover:bg-brassLight disabled:opacity-50"
        >
          {saving ? "Saving…" : "Update Rate"}
        </button>
      </div>

      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      {success && <p className="mt-2 text-xs text-emerald-400">✓ Rate updated successfully.</p>}

      <p className="mt-3 text-xs text-slate/50">
        Changing this rate takes effect immediately for new escrow holds.
        Existing holds use the rate that was active when they were created.
      </p>
    </div>
  );
}

export default function AdminCommissionPage() {
  const [data, setData] = useState<CommissionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/commission");
      const json = await res.json();
      if (!res.ok) { setError(json.error?.message ?? "Could not load commission rates."); return; }
      setData(json);
    } catch { setError("Network error."); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleUpdate(sellerType: "individual" | "business", ratePercent: number) {
    const res = await fetch("/api/admin/commission", {
      method: "PUT",
      headers: { "Content-Type": "application/json", "x-csrf-token": getCsrf() },
      body: JSON.stringify({ sellerType, ratePercent }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message ?? "Update failed.");
    // Refresh data
    await load();
  }

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="font-display text-2xl text-cream">Commission Rates</h1>
        <p className="mt-1 text-sm text-slate">
          Set the platform commission rate per seller type. Changes take effect immediately
          for new escrow holds — existing holds are unaffected.
        </p>
      </div>

      {error && (
        <p className="mb-4 rounded-sm border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1].map((i) => <div key={i} className="h-48 animate-pulse rounded-sm bg-surface" />)}
        </div>
      ) : data ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <RateCard sellerType="individual" current={data.individual} onUpdate={handleUpdate} />
          <RateCard sellerType="business" current={data.business} onUpdate={handleUpdate} />
        </div>
      ) : null}

      <div className="mt-8 rounded-sm border border-white/[0.08] bg-surface p-5">
        <h2 className="mb-3 text-sm font-semibold text-cream">How commission works</h2>
        <div className="space-y-2 text-xs text-slate leading-relaxed">
          <p>When an order is marked as paid, the platform deducts a commission from the seller&apos;s escrow hold before releasing funds to their wallet.</p>
          <p>Example: seller earns PKR 1,000 on a sale, commission rate is 5% → platform keeps PKR 50, seller receives PKR 950 when the escrow releases.</p>
          <p>Commission rates are stored as time-series records — every historical rate is preserved for audit and reconciliation purposes. Changing the rate here creates a new record with <code className="rounded bg-ink/40 px-1">effectiveTo: null</code> (open-ended) and closes the previous record.</p>
        </div>
      </div>
    </AdminLayout>
  );
}
