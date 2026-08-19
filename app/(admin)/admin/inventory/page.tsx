"use client";

import { useEffect, useState, useCallback } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";

interface InventoryProduct {
  id: string;
  name: string;
  sku: string;
  stockQty: number;
  lowStockThreshold: number;
  status: string;
  category: { name: string };
}

function getCsrf(): string {
  return (
    document.cookie
      .split("; ")
      .find((c) => c.startsWith("csrf_token="))
      ?.split("=")[1] ?? ""
  );
}

export default function AdminInventoryPage() {
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "low" | "out">("all");
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/products?pageSize=100");
      const data = await res.json();
      setProducts(data.items ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = products.filter((p) => {
    if (filter === "low") return p.stockQty > 0 && p.stockQty <= p.lowStockThreshold;
    if (filter === "out") return p.stockQty === 0;
    return true;
  });

  async function saveStock(productId: string) {
    const newQty = Number(editing[productId]);
    if (isNaN(newQty) || newQty < 0) return;

    setSaving((s) => ({ ...s, [productId]: true }));
    setError(null);

    try {
      const res = await fetch(`/api/admin/products/${productId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": getCsrf(),
        },
        body: JSON.stringify({ stockQty: newQty }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? "Failed to update stock.");
        return;
      }
      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, stockQty: newQty } : p))
      );
      setEditing((e) => { const next = { ...e }; delete next[productId]; return next; });
    } catch {
      setError("Network error.");
    } finally {
      setSaving((s) => { const next = { ...s }; delete next[productId]; return next; });
    }
  }

  const lowCount = products.filter((p) => p.stockQty > 0 && p.stockQty <= p.lowStockThreshold).length;
  const outCount = products.filter((p) => p.stockQty === 0).length;

  return (
    <AdminLayout>
      <h1 className="font-display text-2xl text-cream mb-6">Inventory</h1>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6">
        {[
          { key: "all", label: `All (${products.length})` },
          { key: "low", label: `Low Stock (${lowCount})`, alert: lowCount > 0 },
          { key: "out", label: `Out of Stock (${outCount})`, alert: outCount > 0 },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key as any)}
            className={`rounded-sm px-4 py-2 text-sm transition ${
              filter === tab.key
                ? "bg-brass text-ink font-semibold"
                : tab.alert
                ? "border border-red-500/30 text-red-400 hover:bg-red-500/10"
                : "border border-white/10 text-slate hover:text-cream"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

      {loading ? (
        <p className="text-sm text-slate">Loading...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-slate">No products match this filter.</p>
      ) : (
        <div className="overflow-x-auto rounded-sm border border-white/[0.08]">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface text-xs uppercase tracking-wider text-slate">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3">Threshold</th>
                <th className="px-4 py-3">Update Stock</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const isLow = p.stockQty > 0 && p.stockQty <= p.lowStockThreshold;
                const isOut = p.stockQty === 0;
                return (
                  <tr key={p.id} className={`border-t border-white/[0.08] ${isOut ? "bg-red-500/5" : isLow ? "bg-yellow-500/5" : ""}`}>
                    <td className="px-4 py-3 text-cream">{p.name}</td>
                    <td className="px-4 py-3 text-slate font-mono text-xs">{p.sku}</td>
                    <td className="px-4 py-3 text-slate">{p.category.name}</td>
                    <td className="px-4 py-3">
                      <span className={`font-semibold ${isOut ? "text-red-400" : isLow ? "text-yellow-400" : "text-emerald-400"}`}>
                        {p.stockQty}
                      </span>
                      {isOut && <span className="ml-2 text-xs text-red-400">Out</span>}
                      {isLow && <span className="ml-2 text-xs text-yellow-400">Low</span>}
                    </td>
                    <td className="px-4 py-3 text-slate">{p.lowStockThreshold}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          placeholder={String(p.stockQty)}
                          value={editing[p.id] ?? ""}
                          onChange={(e) => setEditing((prev) => ({ ...prev, [p.id]: e.target.value }))}
                          className="w-20 rounded-sm border border-white/10 bg-ink/40 px-2 py-1 text-sm text-cream outline-none focus:border-brass/50"
                        />
                        {editing[p.id] !== undefined && (
                          <button
                            onClick={() => saveStock(p.id)}
                            disabled={saving[p.id]}
                            className="rounded-sm bg-brass px-3 py-1 text-xs font-semibold text-ink transition hover:bg-brassLight disabled:opacity-50"
                          >
                            {saving[p.id] ? "…" : "Save"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  );
}
