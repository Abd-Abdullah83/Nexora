"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { AdminLayout } from "@/components/admin/AdminLayout";

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  total: number;
  currency: string;
  createdAt: string;
  user: { fullName: string; email: string };
}

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-400",
  confirmed: "bg-blue-500/15 text-blue-400",
  shipped: "bg-blue-500/15 text-blue-400",
  delivered: "bg-emerald-500/15 text-emerald-400",
  cancelled: "bg-slate/15 text-slate",
  refunded: "bg-red-500/15 text-red-400",
};

const PAYMENT_STYLES: Record<string, string> = {
  unpaid: "bg-amber-500/15 text-amber-400",
  paid: "bg-emerald-500/15 text-emerald-400",
  failed: "bg-red-500/15 text-red-400",
  refunded: "bg-red-500/15 text-red-400",
};

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/admin/orders?${params}`);
      const data = await res.json();
      setOrders(data.items ?? []);
      setTotalPages(data.totalPages ?? 1);
      setTotal(data.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page]);

  useEffect(() => { load(); }, [load]);

  return (
    <AdminLayout>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl text-cream">Orders</h1>
        <span className="text-sm text-slate">{total} total</span>
      </div>

      {/* Status filters */}
      <div className="mb-6 flex flex-wrap gap-2">
        {["all", "pending", "confirmed", "shipped", "delivered", "cancelled", "refunded"].map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`rounded-sm px-4 py-2 text-sm capitalize transition ${
              statusFilter === s
                ? "bg-brass text-ink font-semibold"
                : "border border-white/10 text-slate hover:text-cream"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-slate">Loading...</p>
      ) : orders.length === 0 ? (
        <p className="text-sm text-slate">No orders found.</p>
      ) : (
        <div className="overflow-x-auto rounded-sm border border-white/[0.08]">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface text-xs uppercase tracking-wider text-slate">
              <tr>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-t border-white/[0.08] text-cream">
                  <td className="px-4 py-3 font-mono text-xs text-brass">{o.orderNumber}</td>
                  <td className="px-4 py-3">
                    <p>{o.user.fullName}</p>
                    <p className="text-xs text-slate">{o.user.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-sm px-2 py-0.5 text-xs capitalize ${STATUS_STYLES[o.status] ?? "bg-white/10 text-slate"}`}>
                      {o.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-sm px-2 py-0.5 text-xs capitalize ${PAYMENT_STYLES[o.paymentStatus] ?? "bg-white/10 text-slate"}`}>
                      {o.paymentStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-brass">
                    {o.currency} {Number(o.total).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate">
                    {new Date(o.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/orders/${o.id}`}
                      className="text-xs text-brass hover:underline"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded-sm border border-white/10 px-3 py-1.5 text-xs text-slate disabled:opacity-40 hover:text-cream">← Prev</button>
          <span className="text-xs text-slate">Page {page} of {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="rounded-sm border border-white/10 px-3 py-1.5 text-xs text-slate disabled:opacity-40 hover:text-cream">Next →</button>
        </div>
      )}
    </AdminLayout>
  );
}
