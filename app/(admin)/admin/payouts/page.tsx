"use client";

import { useEffect, useState, useCallback } from "react";

function getCsrf() {
  return document.cookie.split("; ").find((c) => c.startsWith("csrf_token="))?.split("=")[1] ?? "";
}

interface PayoutItem {
  id: string;
  amount: string;
  currency: string;
  status: string;
  bankAccountSnapshot: { bankName: string; accountNumberMasked: string; accountHolderName: string };
  adminNote: string | null;
  requestedAt: string;
  processedAt: string | null;
  seller: { id: string; displayName: string | null; businessEmail: string | null; sellerType: string };
}

interface QueueData { items: PayoutItem[]; total: number; page: number; totalPages: number; }

const STATUS_STYLES: Record<string, string> = {
  requested:  "bg-gold/15 text-gold",
  processing: "bg-blue-100 text-blue-700",
  paid:       "bg-emerald/15 text-emerald",
  failed:     "bg-red-100 text-red-700",
  cancelled:  "bg-gray-100 text-gray-600",
};

function fmt(amount: string | number, currency = "PKR") {
  return `${currency} ${Number(amount).toLocaleString("en-PK", { minimumFractionDigits: 2 })}`;
}

async function adminAction(payoutId: string, action: string, adminNote?: string) {
  const res = await fetch(`/api/admin/payouts/${payoutId}/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-csrf-token": getCsrf() },
    body: JSON.stringify({ adminNote }),
  });
  return res;
}

export default function AdminPayoutsPage() {
  const [data, setData] = useState<QueueData | null>(null);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [noteModal, setNoteModal] = useState<{ id: string; action: "failed" | "cancel" } | null>(null);
  const [noteText, setNoteText] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/payouts?status=${statusFilter}&page=${page}&pageSize=25`);
      const json = await res.json();
      if (res.ok) setData(json);
    } finally { setLoading(false); }
  }, [statusFilter, page]);

  useEffect(() => { load(); }, [load]);

  async function doAction(payoutId: string, action: string, note?: string) {
    setActionError(null);
    setProcessingId(payoutId);
    try {
      const res = await adminAction(payoutId, action, note);
      const json = await res.json();
      if (!res.ok) { setActionError(json.error?.message ?? "Action failed."); return; }
      load();
    } finally { setProcessingId(null); }
  }

  const FILTERS = ["pending", "processing", "paid", "failed", "cancelled"];

  return (
    <div className="min-h-screen bg-ink">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <h1 className="font-display text-2xl text-cream">Payout Queue</h1>
        <p className="mt-1 text-sm text-slate">Review and process seller payout requests.</p>

        {actionError && (
          <p className="mt-4 rounded-sm border border-red-500/30 bg-red-900/20 p-3 text-sm text-red-400">{actionError}</p>
        )}

        {/* Status filter tabs */}
        <div className="mt-6 flex gap-1 border-b border-white/10">
          {FILTERS.map((f) => (
            <button key={f} onClick={() => { setStatusFilter(f); setPage(1); }}
              className={`px-4 py-2 text-sm capitalize transition ${
                statusFilter === f ? "border-b-2 border-brass font-medium text-cream" : "text-slate hover:text-cream"
              }`}>
              {f}
            </button>
          ))}
        </div>

        {loading && (
          <div className="mt-6 space-y-3">
            {[1,2,3].map((i) => <div key={i} className="h-16 animate-pulse rounded-sm bg-surface" />)}
          </div>
        )}

        {!loading && data && data.items.length === 0 && (
          <p className="mt-8 text-sm text-slate">No {statusFilter} payouts.</p>
        )}

        {!loading && data && data.items.length > 0 && (
          <div className="mt-6 overflow-hidden rounded-sm border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-surface">
                <tr>
                  {["Seller", "Amount", "Bank", "Status", "Requested", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 bg-ink">
                {data.items.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-cream">{p.seller.displayName ?? "—"}</p>
                      <p className="text-xs text-slate">{p.seller.businessEmail}</p>
                    </td>
                    <td className="px-4 py-3 font-medium text-cream">{fmt(p.amount, p.currency)}</td>
                    <td className="px-4 py-3 text-xs text-slate">
                      <p>{p.bankAccountSnapshot.accountHolderName}</p>
                      <p>{p.bankAccountSnapshot.bankName} · {p.bankAccountSnapshot.accountNumberMasked}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-sm px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[p.status] ?? ""}`}>
                        {p.status}
                      </span>
                      {p.adminNote && (
                        <p className="mt-0.5 text-xs text-slate/70">{p.adminNote}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate whitespace-nowrap">
                      {new Date(p.requestedAt).toLocaleDateString("en-PK")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        {p.status === "requested" && (
                          <>
                            <ActionBtn label="Mark processing" disabled={processingId === p.id}
                              onClick={() => doAction(p.id, "processing")} color="blue" />
                            <ActionBtn label="Cancel" disabled={processingId === p.id}
                              onClick={() => { setNoteModal({ id: p.id, action: "cancel" }); setNoteText(""); }} color="gray" />
                          </>
                        )}
                        {p.status === "processing" && (
                          <>
                            <ActionBtn label="Mark paid ✓" disabled={processingId === p.id}
                              onClick={() => doAction(p.id, "paid")} color="green" />
                            <ActionBtn label="Mark failed" disabled={processingId === p.id}
                              onClick={() => { setNoteModal({ id: p.id, action: "failed" }); setNoteText(""); }} color="red" />
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-white/10 bg-surface px-4 py-2.5">
                <p className="text-xs text-slate">Page {page} of {data.totalPages}</p>
                <div className="flex gap-2">
                  <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}
                    className="text-xs text-brass disabled:text-slate/50">← Prev</button>
                  <button disabled={page === data.totalPages} onClick={() => setPage((p) => p + 1)}
                    className="text-xs text-brass disabled:text-slate/50">Next →</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Note/reason modal */}
        {noteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="w-full max-w-md rounded-sm border border-white/10 bg-surface p-6 shadow-xl">
              <h3 className="font-display text-lg text-cream capitalize">
                {noteModal.action === "failed" ? "Mark payout failed" : "Cancel payout"}
              </h3>
              <p className="mt-1 text-sm text-slate">
                {noteModal.action === "failed"
                  ? "Explain why this payout failed — shown to the seller."
                  : "Reason for cancellation (optional)."}
              </p>
              <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} rows={3}
                placeholder={noteModal.action === "failed" ? "e.g. Bank returned funds — invalid account number" : "Optional note"}
                className="mt-3 w-full rounded-sm border border-white/10 bg-ink px-3 py-2 text-sm text-cream outline-none resize-none focus:border-brass" />
              <div className="mt-4 flex gap-3 justify-end">
                <button onClick={() => setNoteModal(null)}
                  className="px-4 py-2 text-sm text-slate hover:text-cream transition">Cancel</button>
                <button
                  disabled={noteModal.action === "failed" && !noteText.trim()}
                  onClick={async () => {
                    const action = noteModal.action === "failed" ? "failed" : "cancel";
                    await doAction(noteModal.id, action, noteText || undefined);
                    setNoteModal(null);
                  }}
                  className={`rounded-sm px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-50 ${
                    noteModal.action === "failed" ? "bg-red-700 hover:bg-red-600" : "bg-surface border border-white/20 hover:border-white/40 text-cream"
                  }`}>
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ActionBtn({ label, onClick, disabled, color }: {
  label: string; onClick: () => void; disabled: boolean;
  color: "blue" | "green" | "red" | "gray";
}) {
  const styles = {
    blue: "bg-blue-900/30 text-blue-300 hover:bg-blue-900/50",
    green: "bg-emerald/20 text-emerald hover:bg-emerald/30",
    red: "bg-red-900/20 text-red-400 hover:bg-red-900/30",
    gray: "bg-white/5 text-slate hover:text-cream",
  };
  return (
    <button onClick={onClick} disabled={disabled}
      className={`rounded-sm px-2.5 py-1 text-xs font-medium transition disabled:opacity-40 ${styles[color]}`}>
      {label}
    </button>
  );
}
