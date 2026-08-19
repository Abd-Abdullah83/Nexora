"use client";

// app/(storefront)/seller/disputes/page.tsx
// Seller's dispute inbox — shows all disputes on their order lines,
// with accept/reject/escalate actions on open ones.

import { useEffect, useState, useCallback } from "react";
import { SellerLayout } from "@/components/seller/SellerLayout";

interface DisputeItem {
  id: string;
  type: "return" | "refund" | "chargeback";
  status: "open" | "seller_review" | "admin_review" | "resolved_refunded" | "resolved_denied";
  buyerReason: string;
  sellerResponse: string | null;
  refundAmount: number | null;
  createdAt: string;
  resolvedAt: string | null;
  orderItem: {
    id: string;
    productName: string;
    totalPrice: number;
    order: { orderNumber: string };
  };
}

const STATUS_LABELS: Record<string, string> = {
  open: "Open — awaiting your response",
  seller_review: "Seller review",
  admin_review: "Admin review",
  resolved_refunded: "Resolved — refunded",
  resolved_denied: "Resolved — denied",
};
const STATUS_STYLES: Record<string, string> = {
  open: "bg-red-50 text-red-700 border-red-200",
  seller_review: "bg-amber-50 text-amber-700 border-amber-200",
  admin_review: "bg-blue-50 text-blue-700 border-blue-200",
  resolved_refunded: "bg-gray-100 text-gray-500 border-gray-200",
  resolved_denied: "bg-gray-100 text-gray-500 border-gray-200",
};
const TYPE_LABELS: Record<string, string> = {
  return: "Return request",
  refund: "Refund request",
  chargeback: "Chargeback / not received",
};

function getCsrf() {
  return document.cookie.split("; ").find((c) => c.startsWith("csrf_token="))?.split("=")[1] ?? "";
}

function RespondPanel({ dispute, onDone }: { dispute: DisputeItem; onDone: () => void }) {
  const [action, setAction] = useState<"accept" | "reject" | "escalate">("accept");
  const [response, setResponse] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/sellers/disputes/${dispute.id}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrf() },
        body: JSON.stringify({ action, sellerResponse: response }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error?.message ?? "Could not submit response.");
        return;
      }
      onDone();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 rounded-sm border border-ivoryBorder bg-ivory p-4">
      <p className="mb-3 text-xs font-medium text-charcoal">Your response</p>
      <div className="mb-3 flex flex-wrap gap-2">
        {(["accept", "reject", "escalate"] as const).map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setAction(a)}
            className={`rounded-sm border px-3 py-1.5 text-xs font-medium capitalize transition ${
              action === a
                ? "border-gold bg-gold/10 text-gold"
                : "border-ivoryBorder text-muted hover:text-charcoal"
            }`}
          >
            {a === "accept" ? "Accept & refund buyer" : a === "reject" ? "Reject dispute" : "Escalate to admin"}
          </button>
        ))}
      </div>
      <textarea
        value={response}
        onChange={(e) => setResponse(e.target.value)}
        rows={3}
        placeholder={
          action === "accept"
            ? "Optional note to the buyer..."
            : "Explain your decision (required, min 10 characters)"
        }
        className="w-full rounded-sm border border-ivoryBorder px-3 py-2 text-sm text-charcoal focus:border-gold focus:outline-none resize-none"
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button
          type="submit"
          disabled={submitting || (action !== "accept" && response.trim().length < 10)}
          className="rounded-sm bg-charcoal px-4 py-2 text-xs font-semibold text-white transition hover:bg-gold disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Submit response"}
        </button>
      </div>
    </form>
  );
}

export default function SellerDisputesPage() {
  const [disputes, setDisputes] = useState<DisputeItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [responding, setResponding] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/sellers/disputes?${params}`);
      const json = await res.json();
      if (!res.ok) { setError(json.error?.message ?? "Could not load disputes."); return; }
      setDisputes(json.items ?? []);
      setTotal(json.total ?? 0);
    } catch { setError("Network error."); }
    finally { setLoading(false); }
  }, [page, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / 20));

  return (
    <SellerLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl text-charcoal">Disputes</h1>
          <p className="mt-1 text-sm text-muted">{total} dispute{total !== 1 ? "s" : ""} total</p>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {["all", "open", "seller_review", "admin_review", "resolved_refunded", "resolved_denied"].map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`rounded-sm border px-3 py-1.5 text-xs transition ${
              statusFilter === s
                ? "border-gold bg-gold/10 text-gold font-medium"
                : "border-ivoryBorder text-muted hover:text-charcoal"
            }`}
          >
            {s === "all" ? "All" : STATUS_LABELS[s] ?? s}
          </button>
        ))}
      </div>

      {error && <p className="mb-4 rounded-sm border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {loading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-24 animate-pulse rounded-sm bg-ivoryDark" />)}</div>
      ) : disputes.length === 0 ? (
        <p className="text-sm text-muted py-12 text-center">No disputes found.</p>
      ) : (
        <div className="space-y-3">
          {disputes.map((d) => (
            <div key={d.id} className="rounded-sm border border-ivoryBorder bg-white p-5 shadow-card">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className={`rounded-sm border px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[d.status]}`}>
                      {STATUS_LABELS[d.status]}
                    </span>
                    <span className="text-xs text-subtle capitalize">{TYPE_LABELS[d.type]}</span>
                  </div>
                  <p className="font-medium text-charcoal text-sm truncate">{d.orderItem.productName}</p>
                  <p className="text-xs text-muted">Order {d.orderItem.order.orderNumber} · PKR {Number(d.orderItem.totalPrice).toLocaleString()}</p>
                  <p className="mt-2 text-xs text-charcoal">{d.buyerReason}</p>
                  {d.sellerResponse && (
                    <p className="mt-1 text-xs text-muted italic">Your response: {d.sellerResponse}</p>
                  )}
                  {d.refundAmount && (
                    <p className="mt-1 text-xs text-emerald-600 font-medium">
                      Refunded: PKR {Number(d.refundAmount).toFixed(2)}
                    </p>
                  )}
                </div>
                <div className="text-xs text-subtle whitespace-nowrap">
                  {new Date(d.createdAt).toLocaleDateString()}
                </div>
              </div>

              {(d.status === "open" || d.status === "seller_review") && (
                <div className="mt-3">
                  {responding === d.id ? (
                    <RespondPanel dispute={d} onDone={() => { setResponding(null); load(); }} />
                  ) : (
                    <button
                      onClick={() => setResponding(d.id)}
                      className="rounded-sm bg-gold/10 border border-gold/30 px-3 py-1.5 text-xs font-medium text-gold transition hover:bg-gold/20"
                    >
                      Respond to dispute
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
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
