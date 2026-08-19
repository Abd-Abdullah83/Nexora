"use client";
// app/(storefront)/seller/customers/page.tsx
// Phase 6 gap fill: seller Customers view.

import { useState, useEffect, useCallback } from "react";
import { SellerLayout } from "@/components/seller/SellerLayout";

interface Customer {
  userId: string;
  fullName: string;
  city: string;
  totalOrders: number;
  totalSpend: number;
  lastOrderAt: string | null;
}

export default function SellerCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const p = new URLSearchParams({ page: String(page), pageSize: "25" });
      if (search) p.set("search", search);
      const res = await fetch(`/api/sellers/customers?${p}`);
      const json = await res.json();
      if (!res.ok) { setError(json.error?.message ?? "Could not load customers."); return; }
      setCustomers(json.customers ?? []);
      setTotal(json.total ?? 0);
    } catch { setError("Network error."); }
    finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / 25));

  return (
    <SellerLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl text-charcoal">Customers</h1>
          <p className="mt-1 text-sm text-muted">{total} buyer{total !== 1 ? "s" : ""} who ordered from you</p>
        </div>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); setSearch(searchInput); setPage(1); }}
        className="mb-5 flex gap-2">
        <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search by name..."
          className="rounded-sm border border-ivoryBorder px-3 py-2 text-sm text-charcoal placeholder:text-muted focus:border-gold focus:outline-none w-56" />
        <button type="submit"
          className="rounded-sm border border-ivoryBorder px-4 py-2 text-sm text-muted hover:text-charcoal transition">
          Search
        </button>
        {search && (
          <button type="button" onClick={() => { setSearch(""); setSearchInput(""); setPage(1); }}
            className="text-sm text-muted underline hover:text-charcoal">Clear</button>
        )}
      </form>

      {error && <p className="mb-4 rounded-sm border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {loading ? (
        <div className="space-y-2">{[...Array(6)].map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-sm bg-ivoryDark" />
        ))}</div>
      ) : customers.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted">
          {search ? "No customers match your search." : "No customers yet — orders placed from your listings will appear here."}
        </p>
      ) : (
        <div className="overflow-hidden rounded-sm border border-ivoryBorder bg-white shadow-card">
          <table className="w-full text-sm">
            <thead className="border-b border-ivoryBorder bg-ivoryDark">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted">City</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted">Orders</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted">Total Spend</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted">Last Order</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ivoryBorder">
              {customers.map((c) => (
                <tr key={c.userId} className="hover:bg-ivory/50 transition">
                  <td className="px-4 py-3 font-medium text-charcoal">{c.fullName}</td>
                  <td className="px-4 py-3 text-muted">{c.city || "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-charcoal">{c.totalOrders}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-charcoal">PKR {c.totalSpend.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-xs text-muted">
                    {c.lastOrderAt ? new Date(c.lastOrderAt).toLocaleDateString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
            className="rounded-sm border border-ivoryBorder px-3 py-1.5 text-xs text-muted disabled:opacity-40 hover:text-charcoal">← Prev</button>
          <span className="text-xs text-muted">Page {page} of {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="rounded-sm border border-ivoryBorder px-3 py-1.5 text-xs text-muted disabled:opacity-40 hover:text-charcoal">Next →</button>
        </div>
      )}
    </SellerLayout>
  );
}
