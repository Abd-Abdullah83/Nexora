"use client";

import { useEffect, useState } from "react";
import { SellerLayout } from "@/components/seller/SellerLayout";

function getCsrf() {
  return document.cookie.split("; ").find((c) => c.startsWith("csrf_token="))?.split("=")[1] ?? "";
}

type Tab = "shipping" | "returns" | "tax";

export default function SellerSettingsPage() {
  const [tab, setTab] = useState<Tab>("shipping");

  const TABS: { key: Tab; label: string }[] = [
    { key: "shipping", label: "Shipping" },
    { key: "returns", label: "Return Policy" },
    { key: "tax", label: "Tax" },
  ];

  return (
    <SellerLayout>
      <h1 className="font-display text-2xl text-charcoal">Store Settings</h1>
      <p className="mt-1 text-sm text-muted">Configure shipping, returns, and tax for your store.</p>

      <div className="mt-6 flex gap-1 border-b border-ivoryBorder">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm transition ${
              tab === t.key
                ? "border-b-2 border-gold font-medium text-charcoal"
                : "text-muted hover:text-charcoal"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "shipping" && <ShippingTab />}
        {tab === "returns" && <ReturnsTab />}
        {tab === "tax" && <TaxTab />}
      </div>
    </SellerLayout>
  );
}

// ── Shipping Tab ──────────────────────────────────────────────────────────

function ShippingTab() {
  const [data, setData] = useState<{ processingTimeDays: number; zonesJson: { region: string; rateAmount: number; currency: string }[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/sellers/shipping-settings")
      .then(async (res) => { const j = await res.json(); setData(j.settings ?? { processingTimeDays: 2, zonesJson: [] }); })
      .catch(() => setError("Network error."))
      .finally(() => setLoading(false));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      const res = await fetch("/api/sellers/shipping-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrf() },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error?.message ?? "Save failed."); return; }
      setData(json.settings);
      setSaved(true); setTimeout(() => setSaved(false), 2500);
    } catch { setError("Network error."); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="h-32 animate-pulse rounded-sm bg-ivoryDark" />;
  if (!data) return null;

  return (
    <form onSubmit={save} className="flex flex-col gap-5 rounded-sm border border-ivoryBorder bg-white p-6 shadow-card">
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div>
        <label className="mb-1.5 block text-sm font-medium text-charcoal">Processing time (days)</label>
        <input type="number" min={0} max={30} value={data.processingTimeDays}
          onChange={(e) => setData({ ...data, processingTimeDays: Number(e.target.value) })}
          className="w-32 rounded-sm border border-ivoryBorder px-3 py-2 text-sm text-charcoal outline-none focus:border-gold" />
        <p className="mt-1 text-xs text-subtle">How many working days before you ship after an order.</p>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-charcoal">Shipping zones</label>
        {data.zonesJson.map((zone, i) => (
          <div key={i} className="mb-2 flex items-center gap-2">
            <input placeholder="Region (e.g. Lahore)" value={zone.region}
              onChange={(e) => { const z = [...data.zonesJson]; z[i] = { ...z[i], region: e.target.value }; setData({ ...data, zonesJson: z }); }}
              className="flex-1 rounded-sm border border-ivoryBorder px-3 py-2 text-sm outline-none focus:border-gold" />
            <input type="number" min={0} placeholder="Rate" value={zone.rateAmount}
              onChange={(e) => { const z = [...data.zonesJson]; z[i] = { ...z[i], rateAmount: Number(e.target.value) }; setData({ ...data, zonesJson: z }); }}
              className="w-24 rounded-sm border border-ivoryBorder px-3 py-2 text-sm outline-none focus:border-gold" />
            <span className="text-xs text-muted">PKR</span>
            <button type="button" onClick={() => { const z = data.zonesJson.filter((_, j) => j !== i); setData({ ...data, zonesJson: z }); }}
              className="text-muted hover:text-red-500 text-lg leading-none">×</button>
          </div>
        ))}
        <button type="button"
          onClick={() => setData({ ...data, zonesJson: [...data.zonesJson, { region: "", rateAmount: 0, currency: "PKR" }] })}
          className="mt-1 text-xs text-gold hover:text-goldDark underline">
          + Add zone
        </button>
      </div>

      <SaveRow saving={saving} saved={saved} />
    </form>
  );
}

// ── Returns Tab ───────────────────────────────────────────────────────────

function ReturnsTab() {
  const [data, setData] = useState<{ returnWindowDays: number; conditionsText: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/sellers/return-policy")
      .then(async (res) => { const j = await res.json(); setData(j.policy ?? { returnWindowDays: 7, conditionsText: null }); })
      .catch(() => setError("Network error."))
      .finally(() => setLoading(false));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      const res = await fetch("/api/sellers/return-policy", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrf() },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error?.message ?? json.error?.details?.returnWindowDays ?? "Save failed."); return; }
      setData(json.policy);
      setSaved(true); setTimeout(() => setSaved(false), 2500);
    } catch { setError("Network error."); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="h-32 animate-pulse rounded-sm bg-ivoryDark" />;
  if (!data) return null;

  return (
    <form onSubmit={save} className="flex flex-col gap-5 rounded-sm border border-ivoryBorder bg-white p-6 shadow-card">
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div>
        <label className="mb-1.5 block text-sm font-medium text-charcoal">Return window (days)</label>
        <input type="number" min={0} max={365} value={data.returnWindowDays}
          onChange={(e) => setData({ ...data, returnWindowDays: Number(e.target.value) })}
          className="w-32 rounded-sm border border-ivoryBorder px-3 py-2 text-sm outline-none focus:border-gold" />
        <p className="mt-1 text-xs text-subtle">Must meet the marketplace minimum. Buyers see this on your product pages.</p>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-charcoal">Conditions (optional)</label>
        <textarea value={data.conditionsText ?? ""} rows={4} placeholder="e.g. Items must be unused and in original packaging."
          onChange={(e) => setData({ ...data, conditionsText: e.target.value || null })}
          className="w-full rounded-sm border border-ivoryBorder px-3.5 py-2.5 text-sm outline-none resize-none placeholder:text-subtle focus:border-gold" />
      </div>

      <SaveRow saving={saving} saved={saved} />
    </form>
  );
}

// ── Tax Tab ───────────────────────────────────────────────────────────────

function TaxTab() {
  const [data, setData] = useState<{ taxRegistrationNumber: string | null; regionRulesJson: { region: string; ratePercent: number }[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/sellers/tax-settings")
      .then(async (res) => { const j = await res.json(); setData(j.settings ?? { taxRegistrationNumber: null, regionRulesJson: [] }); })
      .catch(() => setError("Network error."))
      .finally(() => setLoading(false));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      const res = await fetch("/api/sellers/tax-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrf() },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error?.message ?? "Save failed."); return; }
      setData(json.settings);
      setSaved(true); setTimeout(() => setSaved(false), 2500);
    } catch { setError("Network error."); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="h-32 animate-pulse rounded-sm bg-ivoryDark" />;
  if (!data) return null;

  return (
    <form onSubmit={save} className="flex flex-col gap-5 rounded-sm border border-ivoryBorder bg-white p-6 shadow-card">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <p className="rounded-sm bg-ivoryDark px-3 py-2 text-xs text-muted">
        This is a storage field, not a tax-calculation engine. Consult your accountant for legally correct rates.
        Tax registration number is private and never shown on public pages.
      </p>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-charcoal">Tax registration number (optional)</label>
        <input value={data.taxRegistrationNumber ?? ""}
          onChange={(e) => setData({ ...data, taxRegistrationNumber: e.target.value || null })}
          placeholder="NTN / STRN / GST number"
          className="w-full rounded-sm border border-ivoryBorder px-3.5 py-2.5 text-sm outline-none placeholder:text-subtle focus:border-gold" />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-charcoal">Tax rules by region</label>
        {data.regionRulesJson.map((rule, i) => (
          <div key={i} className="mb-2 flex items-center gap-2">
            <input placeholder="Region" value={rule.region}
              onChange={(e) => { const r = [...data.regionRulesJson]; r[i] = { ...r[i], region: e.target.value }; setData({ ...data, regionRulesJson: r }); }}
              className="flex-1 rounded-sm border border-ivoryBorder px-3 py-2 text-sm outline-none focus:border-gold" />
            <input type="number" min={0} max={100} step={0.01} placeholder="Rate %" value={rule.ratePercent}
              onChange={(e) => { const r = [...data.regionRulesJson]; r[i] = { ...r[i], ratePercent: Number(e.target.value) }; setData({ ...data, regionRulesJson: r }); }}
              className="w-24 rounded-sm border border-ivoryBorder px-3 py-2 text-sm outline-none focus:border-gold" />
            <span className="text-xs text-muted">%</span>
            <button type="button" onClick={() => { const r = data.regionRulesJson.filter((_, j) => j !== i); setData({ ...data, regionRulesJson: r }); }}
              className="text-muted hover:text-red-500 text-lg leading-none">×</button>
          </div>
        ))}
        <button type="button"
          onClick={() => setData({ ...data, regionRulesJson: [...data.regionRulesJson, { region: "", ratePercent: 0 }] })}
          className="mt-1 text-xs text-gold hover:text-goldDark underline">+ Add rule</button>
      </div>

      <SaveRow saving={saving} saved={saved} />
    </form>
  );
}

function SaveRow({ saving, saved }: { saving: boolean; saved: boolean }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <button type="submit" disabled={saving}
        className="rounded-sm bg-charcoal px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-gold disabled:opacity-50">
        {saving ? "Saving…" : "Save Changes"}
      </button>
      {saved && <p className="text-sm text-emerald">✓ Saved</p>}
    </div>
  );
}
