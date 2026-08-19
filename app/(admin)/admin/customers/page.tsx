"use client";

import { useEffect, useState, useCallback } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";

interface Customer {
  id: string;
  fullName: string;
  email: string;
  username: string | null;
  emailVerified: boolean;
  createdAt: string;
  _count: { orders: number };
}

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      params.set("page", String(page));
      const res = await fetch(`/api/admin/customers?${params.toString()}`);
      const data = await res.json();
      setCustomers(data.items ?? []);
      setTotalPages(data.totalPages ?? 1);
      setTotal(data.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => { load(); }, [load]);

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl text-cream">Customers</h1>
        <span className="text-sm text-slate">{total} total</span>
      </div>

      <div className="mb-6">
        <input
          type="search"
          placeholder="Search by name, email, or username..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-full max-w-sm rounded-sm border border-white/10 bg-surface px-3 py-2 text-sm text-cream outline-none placeholder:text-slate/60 focus:border-brass/50"
        />
      </div>

      {loading ? (
        <p className="text-sm text-slate">Loading...</p>
      ) : customers.length === 0 ? (
        <p className="text-sm text-slate">No customers found.</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-sm border border-white/[0.08]">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface text-xs uppercase tracking-wider text-slate">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Username</th>
                  <th className="px-4 py-3">Verified</th>
                  <th className="px-4 py-3">Orders</th>
                  <th className="px-4 py-3">Joined</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id} className="border-t border-white/[0.08] text-cream">
                    <td className="px-4 py-3">{c.fullName}</td>
                    <td className="px-4 py-3 text-slate">{c.email}</td>
                    <td className="px-4 py-3 text-slate">{c.username ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-sm px-2 py-0.5 text-xs ${c.emailVerified ? "bg-emerald-500/20 text-emerald-300" : "bg-yellow-500/20 text-yellow-300"}`}>
                        {c.emailVerified ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate">{c._count.orders}</td>
                    <td className="px-4 py-3 text-xs text-slate">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-sm border border-white/10 px-3 py-1.5 text-xs text-slate disabled:opacity-40 hover:text-cream"
              >
                ← Prev
              </button>
              <span className="text-xs text-slate">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded-sm border border-white/10 px-3 py-1.5 text-xs text-slate disabled:opacity-40 hover:text-cream"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </AdminLayout>
  );
}
