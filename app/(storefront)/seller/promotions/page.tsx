"use client";

import { useEffect, useState, useCallback } from "react";
import { SellerLayout } from "@/components/seller/SellerLayout";

interface Promotion {
  id: string;
  code: string;
  description: string | null;
  promotionType: "percentage" | "fixed_amount";
  discountValue: number;
  minOrderAmount: number | null;
  maxUses: number | null;
  usedCount: number;
  expiresAt: string | null;
  isActive: boolean;
  productId: string | null;
}

function getCsrf(): string {
  return document.cookie.split("; ").find((c) => c.startsWith("csrf_token="))?.split("=")[1] ?? "";
}

const EMPTY_FORM = {
  code: "",
  description: "",
  promotionType: "percentage" as const,
  discountValue: "",
  minOrderAmount: "",
  maxUses: "",
  expiresAt: "",
  productId: "",
};

export default function SellerPromotionsPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/sellers/promotions");
    const data = await res.json();
    setPromotions(data.promotions ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/sellers/promotions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrf() },
        body: JSON.stringify({
          code: form.code.toUpperCase(),
          description: form.description || undefined,
          promotionType: form.promotionType,
          discountValue: Number(form.discountValue),
          minOrderAmount: form.minOrderAmount ? Number(form.minOrderAmount) : null,
          maxUses: form.maxUses ? Number(form.maxUses) : null,
          expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
          productId: form.productId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error?.message ?? "Failed to create."); return; }
      setForm(EMPTY_FORM);
      setShowForm(false);
      load();
    } finally { setSaving(false); }
  }

  async function handleToggle(id: string, isActive: boolean) {
    await fetch(`/api/sellers/promotions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-csrf-token": getCsrf() },
      body: JSON.stringify({ isActive: !isActive }),
    });
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this promotion?")) return;
    await fetch(`/api/sellers/promotions/${id}`, {
      method: "DELETE",
      headers: { "x-csrf-token": getCsrf() },
    });
    load();
  }

  return (
    <SellerLayout>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl text-charcoal">Promotions</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-sm bg-charcoal px-4 py-2 text-sm font-semibold text-white transition hover:bg-gold"
        >
          {showForm ? "Cancel" : "+ New Promotion"}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} className="mb-6 rounded-sm border border-ivoryBorder bg-white p-6">
          <h2 className="mb-4 font-display text-base text-charcoal">Create Promotion</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted">Code *</label>
              <input required name="code" value={form.code} onChange={handleChange}
                placeholder="SUMMER20" className="w-full rounded-sm border border-ivoryBorder bg-ivory px-3 py-2 text-sm font-mono uppercase outline-none focus:border-gold" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted">Type *</label>
              <select name="promotionType" value={form.promotionType} onChange={handleChange}
                className="w-full rounded-sm border border-ivoryBorder bg-ivory px-3 py-2 text-sm outline-none focus:border-gold">
                <option value="percentage">Percentage (%)</option>
                <option value="fixed_amount">Fixed Amount (PKR)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted">Discount Value *</label>
              <input required type="number" name="discountValue" value={form.discountValue} onChange={handleChange}
                placeholder={form.promotionType === "percentage" ? "e.g. 20" : "e.g. 500"}
                className="w-full rounded-sm border border-ivoryBorder bg-ivory px-3 py-2 text-sm outline-none focus:border-gold" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted">Min Order (PKR)</label>
              <input type="number" name="minOrderAmount" value={form.minOrderAmount} onChange={handleChange}
                placeholder="Optional"
                className="w-full rounded-sm border border-ivoryBorder bg-ivory px-3 py-2 text-sm outline-none focus:border-gold" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted">Max Uses</label>
              <input type="number" name="maxUses" value={form.maxUses} onChange={handleChange}
                placeholder="Unlimited"
                className="w-full rounded-sm border border-ivoryBorder bg-ivory px-3 py-2 text-sm outline-none focus:border-gold" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted">Expires At</label>
              <input type="datetime-local" name="expiresAt" value={form.expiresAt} onChange={handleChange}
                className="w-full rounded-sm border border-ivoryBorder bg-ivory px-3 py-2 text-sm outline-none focus:border-gold" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted">Description</label>
              <input name="description" value={form.description} onChange={handleChange}
                placeholder="Optional note for buyers"
                className="w-full rounded-sm border border-ivoryBorder bg-ivory px-3 py-2 text-sm outline-none focus:border-gold" />
            </div>
          </div>
          {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
          <button type="submit" disabled={saving}
            className="mt-4 rounded-sm bg-gold px-6 py-2 text-sm font-semibold text-white transition hover:bg-charcoal disabled:opacity-50">
            {saving ? "Creating…" : "Create Promotion"}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : promotions.length === 0 ? (
        <div className="rounded-sm border border-ivoryBorder bg-white p-10 text-center">
          <p className="text-sm text-muted">No promotions yet. Create one to offer discounts on your listings.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-sm border border-ivoryBorder bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-ivory text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Value</th>
                <th className="px-4 py-3">Uses</th>
                <th className="px-4 py-3">Expires</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {promotions.map((p) => (
                <tr key={p.id} className="border-t border-ivoryBorder text-charcoal">
                  <td className="px-4 py-3 font-mono font-semibold text-gold">{p.code}</td>
                  <td className="px-4 py-3 capitalize text-muted">{p.promotionType.replace("_", " ")}</td>
                  <td className="px-4 py-3">
                    {p.promotionType === "percentage" ? `${p.discountValue}%` : `PKR ${p.discountValue}`}
                  </td>
                  <td className="px-4 py-3">
                    {p.usedCount}{p.maxUses ? `/${p.maxUses}` : ""}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">
                    {p.expiresAt ? new Date(p.expiresAt).toLocaleDateString() : "Never"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${p.isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                      {p.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3 text-xs">
                      <button onClick={() => handleToggle(p.id, p.isActive)}
                        className="text-gold hover:underline">
                        {p.isActive ? "Pause" : "Activate"}
                      </button>
                      <button onClick={() => handleDelete(p.id)} className="text-red-500 hover:underline">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SellerLayout>
  );
}
