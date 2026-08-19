// app/(storefront)/seller/orders/page.tsx
//
// Phase 6 — seller-facing order list. Shows only this seller's own
// order_items (never another seller's lines, even on a shared order).

"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { SellerLayout } from "@/components/seller/SellerLayout";

interface OrderLine {
  id: string;
  orderId: string;
  orderNumber: string;
  productName: string;
  productSku: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  fulfillmentStatus: "pending" | "confirmed" | "shipped" | "delivered" | "cancelled";
  buyerName: string;
  orderPlacedAt: string;
  orderPaymentStatus: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  confirmed: "bg-blue-100 text-blue-700",
  shipped: "bg-purple-100 text-purple-700",
  delivered: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-700",
};

export default function SellerOrdersPage() {
  const [lines, setLines] = useState<OrderLine[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/sellers/orders?${params.toString()}`);
      const data = await res.json();
      setLines(data.items ?? []);
      setCounts(data.counts ?? {});
      setTotalPages(data.totalPages ?? 1);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page]);

  useEffect(() => { load(); }, [load]);

  return (
    <SellerLayout>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl text-charcoal">Orders</h1>
      </div>

      {/* Status tabs with counts */}
      <div className="mb-6 flex flex-wrap gap-2">
        {[
          { key: "", label: "All" },
          { key: "pending", label: "Pending" },
          { key: "confirmed", label: "Confirmed" },
          { key: "shipped", label: "Shipped" },
          { key: "delivered", label: "Delivered" },
          { key: "cancelled", label: "Cancelled" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setStatusFilter(tab.key); setPage(1); }}
            className={`rounded-sm px-4 py-2 text-sm transition ${
              statusFilter === tab.key
                ? "bg-charcoal text-white font-semibold"
                : "border border-ivoryBorder bg-white text-charcoal hover:border-gold"
            }`}
          >
            {tab.label}
            {tab.key && counts[tab.key] !== undefined && (
              <span className="ml-1.5 text-xs opacity-70">({counts[tab.key]})</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading orders…</p>
      ) : lines.length === 0 ? (
        <div className="rounded-sm border border-ivoryBorder bg-white p-10 text-center">
          <p className="text-sm text-muted">No orders in this category yet.</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-sm border border-ivoryBorder bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-ivory text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Buyer</th>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Qty</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.id} className="border-t border-ivoryBorder text-charcoal">
                    <td className="px-4 py-3 font-mono text-xs text-gold">{line.orderNumber}</td>
                    <td className="px-4 py-3">{line.buyerName}</td>
                    <td className="px-4 py-3">
                      <p>{line.productName}</p>
                      <p className="text-xs text-muted">{line.productSku}</p>
                    </td>
                    <td className="px-4 py-3">{line.quantity}</td>
                    <td className="px-4 py-3">PKR {line.totalPrice.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_COLORS[line.fulfillmentStatus]}`}>
                        {line.fulfillmentStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">
                      {new Date(line.orderPlacedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/seller/orders/${line.id}`} className="text-xs text-gold hover:underline">
                        Manage
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-sm border border-ivoryBorder px-3 py-1.5 text-xs text-muted disabled:opacity-40 hover:text-charcoal"
              >
                ← Prev
              </button>
              <span className="text-xs text-muted">Page {page} of {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded-sm border border-ivoryBorder px-3 py-1.5 text-xs text-muted disabled:opacity-40 hover:text-charcoal"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </SellerLayout>
  );
}
