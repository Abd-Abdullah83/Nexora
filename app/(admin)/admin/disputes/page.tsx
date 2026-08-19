"use client";

// app/(admin)/admin/disputes/page.tsx
// Admin arbitration queue — full order/escrow context + resolve controls.

import { useEffect, useState, useCallback } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";

interface AdminDisputeItem {
  id: string;
  type: "return" | "refund" | "chargeback";
  status: "open" | "seller_review" | "admin_review" | "resolved_refunded" | "resolved_denied";
  buyerReason: string;
  sellerResponse: string | null;
  sellerResponseAt: string | null;
  refundAmount: number | null;
  resolutionNotes: string | null;
  createdAt: string;
  resolvedAt: string | null;
  orderItem: {
    id: string;
    productName: string;
    totalPrice: number;
    sellerId: string;
    order: {
      orderNumber: string;
      userId: string;
      user: { fullName: string; email: string };
    };
  };
}

const STATUS_STYLES: Record<string, string> = {
  open: "bg-red-500/10 text-red-300 border-red-500/30",
  seller_review: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  admin_review: "bg-blue-500/10 text-blue-300 border-blue-500/30",
  resolved_refunded: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  resolved_denied: "bg-white/5 text-slate border-white/10",
};

const TYPE_LABELS: Record<string, string> = {
  return: "Return", refund: "Refund", chargeback: "Chargeback",
};

function getCsrf() {
  return document.cookie.split("; ").find((c) => c.startsWith("csrf_token="))?.split("=")[1] ?? "";
}

function ResolvePanel({ dispute, onDone }: { dispute: AdminDisputeItem; onDone: () => void }) {
  const [outcome, setOutcome] = useState<"refund" | "deny">("refund");
  const [notes, setNotes] = useState("");
  const [refundAmount, setRefundAmount] = useState(String(dispute.orderItem.totalPrice));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = { outcome, resolutionNotes: notes };
      if (outcome === "refund") body.refundAmount = Number(refundAmount);
      const res = await fetch(`/api/admin/disputes/${dispute.id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrf() },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error?.message ?? "Could not resolve."); return; }
      onDone();
    } catch { setError("Network error."); }
    finally { setSubmitting(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 rounded-sm border border-white/[0.08] bg-ink p-4">
      <p className="mb-3 text-xs font-medium text-cream">Final ruling</p>
      <div className="mb-3 flex gap-2">
        {(["refund", "deny"] as const).map((o) => (
          <button key={o} type="button" onClick={() => setOutcome(o)}
            className={`rounded-sm border px-3 py-1.5 text-xs font-medium capitalize transition ${
              outcome === o ? "border-brass bg-brass/10 text-brass" : "border-white/10 text-slate hover:text-cream"
            }`}>
            {o === "refund" ? "Grant refund" : "Deny dispute"}
          </button>
        ))}
      </div>

      {outcome === "refund" && (
        <div className="mb-3">
          <label className="mb-1 block text-xs text-slate">
            Refund amount (PKR) — max {Number(dispute.orderItem.totalPrice).toFixed(2)}
          </label>
          <input type="number" value={refundAmount}
            onChange={(e) => setRefundAmount(e.target.value)}
            step="0.01" min="0.01" max={dispute.orderItem.totalPrice}
            className="w-40 rounded-sm border border-white/10 bg-surface px-3 py-1.5 text-sm text-cream focus:border-brass focus:outline-none" />
        </div>
      )}

      <div className="mb-3">
        <label className="mb-1 block text-xs text-slate">Resolution notes (required, min 10 chars)</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
          placeholder="Explain the decision to both parties..."
          className="w-full resize-none rounded-sm border border-white/10 bg-surface px-3 py-1.5 text-sm text-cream focus:border-brass focus:outline-none" />
      </div>

      {error && <p className="mb-2 text-xs text-red-400">{error}</p>}

      <div className="flex gap-2">
        <button type="submit"
          disabled={submitting || notes.trim().length < 10 || (outcome === "refund" && Number(refundAmount) <= 0)}
          className="rounded-sm bg-brass px-4 py-2 text-xs font-semibold text-ink transition hover:bg-brassLight disabled:opacity-50">
          {submitting ? "Resolving…" : "Submit ruling"}
        </button>
      </div>
    </form>
  );
}

export default function AdminDisputesPage() {
  const [disputes, setDisputes] = useState<AdminDisputeItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("admin_review");
  const [page, setPage] = useState(1);
  const [resolving, setResolving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/admin/disputes?${params}`);
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
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl text-cream">Dispute Arbitration</h1>
        <span className="text-sm text-slate">{total} total</span>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {["all", "open", "seller_review", "admin_review", "resolved_refunded", "resolved_denied"].map((s) => (
          <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`rounded-sm border px-3 py-1.5 text-xs capitalize transition ${
              statusFilter === s ? "border-brass bg-brass/10 text-brass font-medium" : "border-white/10 text-slate hover:text-cream"
            }`}>
            {s.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      {error && <p className="mb-4 rounded-sm border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}

      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-28 animate-pulse rounded-sm bg-surface" />)}</div>
      ) : disputes.length === 0 ? (
        <p className="text-sm text-slate py-12 text-center">No disputes in this view.</p>
      ) : (
        <div className="space-y-4">
          {disputes.map((d) => (
            <div key={d.id} className="rounded-sm border border-white/[0.08] bg-surface p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className={`rounded-sm border px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[d.status]}`}>
                      {d.status.replace(/_/g, " ")}
                    </span>
                    <span className="rounded-sm bg-white/5 border border-white/10 px-2 py-0.5 text-xs text-slate capitalize">
                      {TYPE_LABELS[d.type]}
                    </span>
                  </div>

                  <p className="font-medium text-cream text-sm">{d.orderItem.productName}</p>
                  <p className="text-xs text-slate">
                    Order {d.orderItem.order.orderNumber} · PKR {Number(d.orderItem.totalPrice).toLocaleString()}
                  </p>
                  <p className="text-xs text-slate/70 mt-0.5">
                    Buyer: {d.orderItem.order.user.fullName} ({d.orderItem.order.user.email})
                  </p>

                  <div className="mt-3 rounded-sm border border-white/[0.06] bg-ink/60 p-3">
                    <p className="text-xs font-medium text-slate mb-1">Buyer's reason:</p>
                    <p className="text-xs text-cream/80">{d.buyerReason}</p>
                  </div>

                  {d.sellerResponse && (
                    <div className="mt-2 rounded-sm border border-white/[0.06] bg-ink/60 p-3">
                      <p className="text-xs font-medium text-slate mb-1">
                        Seller's response {d.sellerResponseAt ? `(${new Date(d.sellerResponseAt).toLocaleDateString()})` : ""}:
                      </p>
                      <p className="text-xs text-cream/80">{d.sellerResponse}</p>
                    </div>
                  )}

                  {d.resolutionNotes && (
                    <div className="mt-2 rounded-sm border border-emerald-500/20 bg-emerald-500/5 p-3">
                      <p className="text-xs font-medium text-emerald-300 mb-1">Resolution:</p>
                      <p className="text-xs text-cream/80">{d.resolutionNotes}</p>
                      {d.refundAmount && (
                        <p className="text-xs text-emerald-300 mt-1">
                          Refund: PKR {Number(d.refundAmount).toFixed(2)}
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <div className="text-xs text-slate/60 whitespace-nowrap">
                  {new Date(d.createdAt).toLocaleDateString()}
                </div>
              </div>

              {["open", "seller_review", "admin_review"].includes(d.status) && (
                <div className="mt-3">
                  {resolving === d.id ? (
                    <ResolvePanel dispute={d} onDone={() => { setResolving(null); load(); }} />
                  ) : (
                    <button onClick={() => setResolving(d.id)}
                      className="rounded-sm bg-brass/20 border border-brass/30 px-3 py-1.5 text-xs font-medium text-brass transition hover:bg-brass/30">
                      Issue final ruling
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
            className="rounded-sm border border-white/10 px-3 py-1.5 text-xs text-slate disabled:opacity-40 hover:text-cream">← Prev</button>
          <span className="text-xs text-slate">Page {page} of {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="rounded-sm border border-white/10 px-3 py-1.5 text-xs text-slate disabled:opacity-40 hover:text-cream">Next →</button>
        </div>
      )}
    </AdminLayout>
  );
}
