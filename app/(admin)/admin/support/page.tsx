"use client";
// app/(admin)/admin/support/page.tsx
// Phase 10 gap fill: admin-side support ticket queue + thread view.
// Matches the dark ink/surface/brass admin theme used by every other
// admin page (disputes, payouts, ban-evasion-alerts).

import { useState, useEffect, useCallback } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";

function getCsrf() {
  return document.cookie.split("; ").find((c) => c.startsWith("csrf_token="))?.split("=")[1] ?? "";
}

interface TicketMessage {
  body: string;
  senderRole: string;
  createdAt: string;
}

interface TicketSummary {
  id: string;
  subject: string;
  status: string;
  priority: string;
  createdAt: string;
  seller: { displayName: string | null; businessEmail: string | null };
  assignee: { fullName: string } | null;
  messages: TicketMessage[]; // latest message only, per getAdminTicketQueue
}

interface TicketDetail extends Omit<TicketSummary, "messages"> {
  messages: (TicketMessage & { id: string })[];
}

const STATUS_STYLES: Record<string, string> = {
  open: "bg-red-500/10 text-red-300 border-red-500/20",
  in_progress: "bg-amber-500/10 text-amber-300 border-amber-500/20",
  resolved: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  closed: "bg-white/5 text-slate border-white/10",
};

const PRIORITY_STYLES: Record<string, string> = {
  urgent: "text-red-300",
  high: "text-amber-300",
  normal: "text-slate",
  low: "text-slate/60",
};

export default function AdminSupportPage() {
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "25" });
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/admin/support?${params}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error?.message ?? "Could not load support tickets.");
        return;
      }
      setTickets(json.items);
      setTotal(json.total);
      setTotalPages(json.totalPages);
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  return (
    <AdminLayout>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl text-cream">Support Tickets</h1>
            <p className="mt-1 text-sm text-slate">Seller support requests, ordered by priority then age.</p>
          </div>
          {!loading && <span className="text-sm text-slate">{total} total</span>}
        </div>

        {/* Status filter tabs */}
        <div className="mt-6 flex gap-1 border-b border-white/10">
          {["", "open", "in_progress", "resolved", "closed"].map((s) => (
            <button
              key={s || "all"}
              onClick={() => {
                setStatusFilter(s);
                setPage(1);
              }}
              className={`px-4 py-2 text-sm capitalize transition ${
                statusFilter === s
                  ? "border-b-2 border-brass font-medium text-cream"
                  : "text-slate hover:text-cream"
              }`}
            >
              {s ? s.replace("_", " ") : "All"}
            </button>
          ))}
        </div>

        {error && (
          <p className="mt-4 rounded-sm border border-red-500/30 bg-red-900/20 p-3 text-sm text-red-400">
            {error}
          </p>
        )}

        {loading && (
          <div className="mt-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-sm bg-surface" />
            ))}
          </div>
        )}

        {!loading && tickets.length === 0 && (
          <p className="mt-8 text-sm text-slate">No {statusFilter || ""} tickets.</p>
        )}

        {!loading && tickets.length > 0 && (
          <div className="mt-6 overflow-hidden rounded-sm border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-surface">
                <tr>
                  {["Seller", "Subject", "Priority", "Status", "Assigned", "Updated"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 bg-ink">
                {tickets.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => setSelectedId(t.id)}
                    className="cursor-pointer hover:bg-surface/60 transition"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-cream">{t.seller.displayName ?? "—"}</p>
                      <p className="text-xs text-slate">{t.seller.businessEmail}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-cream">{t.subject}</p>
                      {t.messages[0] && (
                        <p className="mt-0.5 truncate text-xs text-slate max-w-xs">
                          {t.messages[0].senderRole === "admin" ? "You: " : ""}
                          {t.messages[0].body}
                        </p>
                      )}
                    </td>
                    <td className={`px-4 py-3 text-xs font-medium capitalize ${PRIORITY_STYLES[t.priority] ?? "text-slate"}`}>
                      {t.priority}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-sm border px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[t.status] ?? ""}`}>
                        {t.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate">{t.assignee?.fullName ?? "Unassigned"}</td>
                    <td className="px-4 py-3 text-xs text-slate whitespace-nowrap">
                      {new Date(t.createdAt).toLocaleDateString("en-PK")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-white/10 bg-surface px-4 py-2.5">
                <p className="text-xs text-slate">
                  Page {page} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="text-xs text-brass disabled:text-slate/50"
                  >
                    ← Prev
                  </button>
                  <button
                    disabled={page === totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="text-xs text-brass disabled:text-slate/50"
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {selectedId && (
          <TicketThreadModal
            ticketId={selectedId}
            onClose={() => setSelectedId(null)}
            onChanged={loadQueue}
          />
        )}
      </div>
    </AdminLayout>
  );
}

function TicketThreadModal({
  ticketId,
  onClose,
  onChanged,
}: {
  ticketId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/support/${ticketId}`);
    const json = await res.json();
    if (res.ok) setTicket(json.ticket);
    setLoading(false);
  }, [ticketId]);

  useEffect(() => {
    load();
  }, [load]);

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim()) return;
    setSending(true);
    setError(null);
    const res = await fetch(`/api/admin/support/${ticketId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-csrf-token": getCsrf() },
      body: JSON.stringify({ body: reply }),
    });
    const json = await res.json();
    setSending(false);
    if (!res.ok) {
      setError(json.error?.message ?? "Could not send reply.");
      return;
    }
    setReply("");
    load();
    onChanged();
  }

  async function markResolved() {
    const res = await fetch(`/api/admin/support/${ticketId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-csrf-token": getCsrf() },
      body: JSON.stringify({ action: "resolve" }),
    });
    if (res.ok) {
      load();
      onChanged();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-sm border border-white/10 bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <h2 className="font-display text-base text-cream">{ticket?.subject ?? "Loading…"}</h2>
            {ticket && (
              <p className="mt-0.5 text-xs text-slate">
                {ticket.seller.displayName} · {ticket.seller.businessEmail}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {ticket && ticket.status !== "resolved" && ticket.status !== "closed" && (
              <button
                onClick={markResolved}
                className="rounded-sm border border-emerald-500/30 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/10 transition"
              >
                Mark resolved
              </button>
            )}
            <button onClick={onClose} className="text-slate hover:text-cream text-lg leading-none">
              ×
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading && <div className="h-32 animate-pulse rounded-sm bg-ink" />}
          {!loading && ticket && (
            <div className="flex flex-col gap-3">
              {ticket.messages.map((m) => (
                <div
                  key={m.id}
                  className={`max-w-[80%] rounded-sm px-3.5 py-2.5 text-sm ${
                    m.senderRole === "admin"
                      ? "self-end bg-brass/15 text-cream"
                      : "self-start bg-ink text-cream border border-white/10"
                  }`}
                >
                  <p>{m.body}</p>
                  <p className="mt-1 text-[10px] text-slate">
                    {m.senderRole === "admin" ? "You" : "Seller"} · {new Date(m.createdAt).toLocaleString("en-PK")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {ticket && ticket.status !== "closed" && (
          <form onSubmit={sendReply} className="border-t border-white/10 p-4">
            {error && <p className="mb-2 text-xs text-red-400">{error}</p>}
            <div className="flex gap-2">
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                rows={2}
                placeholder="Reply to seller…"
                className="flex-1 resize-none rounded-sm border border-white/10 bg-ink px-3 py-2 text-sm text-cream outline-none focus:border-brass"
              />
              <button
                type="submit"
                disabled={sending || !reply.trim()}
                className="rounded-sm bg-brass px-4 py-2 text-sm font-semibold text-ink transition hover:bg-brassLight disabled:opacity-50"
              >
                {sending ? "…" : "Send"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
