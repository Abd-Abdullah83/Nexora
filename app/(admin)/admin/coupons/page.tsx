"use client";

import { useEffect, useState, useCallback } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";

interface Coupon {
  id: string;
  code: string;
  description: string | null;
  discountType: "percentage" | "fixed_amount";
  discountValue: number;
  minOrderAmount: number | null;
  maxUses: number | null;
  usedCount: number;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
  _count: { orders: number };
}

function getCsrf(): string {
  return (
    document.cookie
      .split("; ")
      .find((c) => c.startsWith("csrf_token="))
      ?.split("=")[1] ?? ""
  );
}

const EMPTY_FORM = {
  code: "",
  description: "",
  discountType: "percentage" as "percentage" | "fixed_amount",
  discountValue: "",
  minOrderAmount: "",
  maxUses: "",
  expiresAt: "",
  isActive: true,
};

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/coupons");
    const data = await res.json();
    setCoupons(data.coupons ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setCreating(true);

    try {
      const res = await fetch("/api/admin/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrf() },
        body: JSON.stringify({
          code: form.code.toUpperCase(),
          description: form.description || undefined,
          discountType: form.discountType,
          discountValue: Number(form.discountValue),
          minOrderAmount: form.minOrderAmount ? Number(form.minOrderAmount) : null,
          maxUses: form.maxUses ? Number(form.maxUses) : null,
          expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
          isActive: form.isActive,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error?.details?.fieldErrors) {
          const fe: Record<string, string> = {};
          for (const [k, v] of Object.entries(data.error.details.fieldErrors)) {
            if (Array.isArray(v) && v[0]) fe[k] = v[0] as string;
          }
          setFieldErrors(fe);
        } else {
          setError(data.error?.message ?? "Failed to create coupon.");
        }
        return;
      }
      setForm(EMPTY_FORM);
      load();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(id: string, isActive: boolean) {
    await fetch(`/api/admin/coupons?id=${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-csrf-token": getCsrf() },
      body: JSON.stringify({ isActive: !isActive }),
    });
    load();
  }

  async function handleDelete(id: string, code: string) {
    if (!confirm(`Delete coupon "${code}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/admin/coupons?id=${id}`, {
      method: "DELETE",
      headers: { "x-csrf-token": getCsrf() },
    });
    if (res.ok) load();
    else {
      const d = await res.json();
      alert(d.error?.message ?? "Failed to delete coupon.");
    }
  }

  const activeCoupons = coupons.filter((c) => c.isActive);
  const inactiveCoupons = coupons.filter((c) => !c.isActive);

  return (
    <AdminLayout>
      <h1 className="font-display text-2xl text-cream mb-6">Coupons</h1>

      {/* Create form */}
      <div className="rounded-sm border border-white/[0.08] bg-surface p-5 mb-8">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-brass">
          Create New Coupon
        </h2>
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wider text-slate">
                Code <span className="text-red-400">*</span>
              </label>
              <input
                name="code"
                value={form.code}
                onChange={handleChange}
                required
                placeholder="SUMMER20"
                className="w-full rounded-sm border border-white/10 bg-ink/40 px-3 py-2 text-sm text-cream font-mono uppercase outline-none focus:border-brass/50"
              />
              {fieldErrors.code && <p className="mt-1 text-xs text-red-400">{fieldErrors.code}</p>}
            </div>
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wider text-slate">
                Description
              </label>
              <input
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder="Summer sale 20% off"
                className="w-full rounded-sm border border-white/10 bg-ink/40 px-3 py-2 text-sm text-cream outline-none focus:border-brass/50"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wider text-slate">
                Discount Type <span className="text-red-400">*</span>
              </label>
              <select
                name="discountType"
                value={form.discountType}
                onChange={handleChange}
                className="w-full rounded-sm border border-white/10 bg-ink/40 px-3 py-2 text-sm text-cream outline-none focus:border-brass/50"
              >
                <option value="percentage">Percentage (%)</option>
                <option value="fixed_amount">Fixed Amount</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wider text-slate">
                Value <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                name="discountValue"
                value={form.discountValue}
                onChange={handleChange}
                required
                min="0.01"
                step="0.01"
                placeholder={form.discountType === "percentage" ? "20" : "500"}
                className="w-full rounded-sm border border-white/10 bg-ink/40 px-3 py-2 text-sm text-cream outline-none focus:border-brass/50"
              />
              {fieldErrors.discountValue && <p className="mt-1 text-xs text-red-400">{fieldErrors.discountValue}</p>}
            </div>
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wider text-slate">
                Min Order Amount
              </label>
              <input
                type="number"
                name="minOrderAmount"
                value={form.minOrderAmount}
                onChange={handleChange}
                min="0"
                placeholder="0"
                className="w-full rounded-sm border border-white/10 bg-ink/40 px-3 py-2 text-sm text-cream outline-none focus:border-brass/50"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wider text-slate">
                Max Uses
              </label>
              <input
                type="number"
                name="maxUses"
                value={form.maxUses}
                onChange={handleChange}
                min="1"
                placeholder="Unlimited"
                className="w-full rounded-sm border border-white/10 bg-ink/40 px-3 py-2 text-sm text-cream outline-none focus:border-brass/50"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wider text-slate">
                Expires At
              </label>
              <input
                type="datetime-local"
                name="expiresAt"
                value={form.expiresAt}
                onChange={handleChange}
                className="w-full rounded-sm border border-white/10 bg-ink/40 px-3 py-2 text-sm text-cream outline-none focus:border-brass/50"
              />
            </div>
            <div className="flex items-end pb-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate">
                <input
                  type="checkbox"
                  name="isActive"
                  checked={form.isActive}
                  onChange={handleChange}
                />
                Active on creation
              </label>
            </div>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={creating}
            className="w-fit rounded-sm bg-brass px-5 py-2.5 text-sm font-semibold uppercase tracking-wider text-ink transition hover:bg-brassLight disabled:opacity-50"
          >
            {creating ? "Creating…" : "Create Coupon"}
          </button>
        </form>
      </div>

      {/* Coupons list */}
      {loading ? (
        <p className="text-sm text-slate">Loading...</p>
      ) : coupons.length === 0 ? (
        <p className="text-sm text-slate">No coupons yet.</p>
      ) : (
        <>
          {activeCoupons.length > 0 && (
            <CouponTable
              title="Active Coupons"
              coupons={activeCoupons}
              onToggle={toggleActive}
              onDelete={handleDelete}
            />
          )}
          {inactiveCoupons.length > 0 && (
            <div className="mt-6">
              <CouponTable
                title="Inactive Coupons"
                coupons={inactiveCoupons}
                onToggle={toggleActive}
                onDelete={handleDelete}
              />
            </div>
          )}
        </>
      )}
    </AdminLayout>
  );
}

function CouponTable({
  title,
  coupons,
  onToggle,
  onDelete,
}: {
  title: string;
  coupons: Coupon[];
  onToggle: (id: string, active: boolean) => void;
  onDelete: (id: string, code: string) => void;
}) {
  return (
    <>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate/60">
        {title}
      </h2>
      <div className="overflow-x-auto rounded-sm border border-white/[0.08]">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface text-xs uppercase tracking-wider text-slate">
            <tr>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Discount</th>
              <th className="px-4 py-3">Min Order</th>
              <th className="px-4 py-3">Uses</th>
              <th className="px-4 py-3">Expires</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {coupons.map((c) => {
              const expired = c.expiresAt && new Date(c.expiresAt) < new Date();
              const exhausted = c.maxUses !== null && c.usedCount >= c.maxUses;
              return (
                <tr key={c.id} className="border-t border-white/[0.08] text-cream">
                  <td className="px-4 py-3">
                    <p className="font-mono font-semibold text-brass">{c.code}</p>
                    {c.description && <p className="text-xs text-slate">{c.description}</p>}
                  </td>
                  <td className="px-4 py-3">
                    {c.discountType === "percentage"
                      ? `${Number(c.discountValue)}% off`
                      : `PKR ${Number(c.discountValue).toFixed(0)} off`}
                  </td>
                  <td className="px-4 py-3 text-slate">
                    {c.minOrderAmount ? `PKR ${Number(c.minOrderAmount).toFixed(0)}` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={exhausted ? "text-red-400" : "text-slate"}>
                      {c.usedCount}{c.maxUses !== null ? ` / ${c.maxUses}` : ""}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {c.expiresAt ? (
                      <span className={expired ? "text-red-400" : "text-slate"}>
                        {new Date(c.expiresAt).toLocaleDateString()}
                        {expired && " (expired)"}
                      </span>
                    ) : (
                      <span className="text-slate">Never</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => onToggle(c.id, c.isActive)}
                        className={`text-xs ${c.isActive ? "text-yellow-400 hover:text-yellow-300" : "text-emerald-400 hover:text-emerald-300"}`}
                      >
                        {c.isActive ? "Disable" : "Enable"}
                      </button>
                      <button
                        onClick={() => onDelete(c.id, c.code)}
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
