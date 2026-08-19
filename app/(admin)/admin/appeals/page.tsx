"use client";

// app/(admin)/admin/appeals/page.tsx
// Admin queue for seller ban/suspend appeals — list + inline thread detail
// with reply and resolve (uphold / lift) actions.

import { useState, useEffect, useCallback } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";

interface AppealMessage {
  id: string;
  senderRole: "system" | "seller" | "admin";
  body: string;
  createdAt: string;
}

interface AppealListItem {
  id: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  seller: {
    id: string;
    displayName: string | null;
    sellerType: string;
    businessEmail: string | null;
    status: string;
    bannedAt: string | null;
    banReason: string | null;
    suspendedUntil: string | null;
  };
  messages: AppealMessage[]; // most recent only, from the list endpoint
}

interface AppealDetail extends Omit<AppealListItem, "messages"> {
  messages: AppealMessage[]; // full history, from the detail endpoint
}

const STATUS_STYLES: Record<string, string> = {
  open:              "bg-red-500/10 text-red-300 border-red-500/20",
  seller_replied:    "bg-amber-500/10 text-amber-300 border-amber-500/20",
  admin_replied:     "bg-blue-500/10 text-blue-300 border-blue-500/20",
  resolved_upheld:   "bg-white/5 text-slate border-white/10",
  resolved_lifted:   "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
};

function getCsrf() {
  return document.cookie.split("; ").find((c) => c.startsWith("csrf_token="))?.split("=")[1] ?? "";
}

function ThreadDetail({ appealId, onChanged }: { appealId: string; onChanged: () => void }) {
  const [detail, setDetail] = useState<AppealDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [replyBody, setReplyBody] = useState("");
  const [sending, setSending] = useState(false);
  const [resolving, setResolving] = useState<"uphold" | "lift" | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/appeals/${appealId}`);
    const json = await res.json();
    setDetail(json.appeal ?? null);
    setLoading(false);
  }, [appealId]);

  useEffect(() => { load(); }, [load]);

  async function sendReply() {
    if (!replyBody.trim()) return;
    setSending(true); setError(null);
    const res = await fetch(`/api/admin/appeals/${appealId}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-csrf-token": getCsrf() },
      body: JSON.stringify({ body: replyBody.trim() }),
    });
    const json = await res.json();
    setSending(false);
    if (!res.ok) { setError(json.error?.message ?? "Could not send reply."); return; }
    setReplyBody("");
    await load();
    onChanged();
  }

  async function submitResolve() {
    if (!resolving || resolutionNote.trim().length < 10) return;
    setSending(true); setError(null);
    const res = await fetch(`/api/admin/appeals/${appealId}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-csrf-token": getCsrf() },
      body: JSON.stringify({ outcome: resolving, resolutionNote: resolutionNote.trim() }),
    });
    const json = await res.json();
    setSending(false);
    if (!res.ok) { setError(json.error?.message ?? "Could not resolve appeal."); return; }
    setResolving(null);
    setResolutionNote("");
    await load();
    onChanged();
  }

  if (loading) return <div className="mt-3 h-40 animate-pulse rounded-sm bg-ink" />;
  if (!detail) return <p className="mt-3 text-xs text-red-400">Could not load thread.</p>;

  const isResolved = detail.status === "resolved_upheld" || detail.status === "resolved_lifted";

  return (
    <div className="mt-3 border-t border-white/[0.06] pt-4">
      <div className="max-h-72 overflow-y-auto rounded-sm border border-white/[0.06] bg-ink p-3 space-y-2">
        {detail.messages.map((m) => (
          <div key={m.id} className={`flex ${m.senderRole === "admin" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-sm px-3 py-2 text-xs whitespace-pre-line ${
              m.senderRole === "system"
                ? "border border-amber-500/30 bg-amber-500/10 text-amber-200 w-full"
                : m.senderRole === "admin"
                ? "bg-brass/20 text-cream"
                : "border border-white/10 bg-surface text-cream"
            }`}>
              <p className="mb-1 text-[9px] uppercase tracking-wide text-slate/70">
                {m.senderRole === "system" ? "System" : m.senderRole === "admin" ? "Admin" : "Seller"}
              </p>
              {m.body}
              <p className="mt-1 text-[9px] text-slate/50">{new Date(m.createdAt).toLocaleString()}</p>
            </div>
          </div>
        ))}
      </div>

      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

      {!isResolved && (
        <>
          <div className="mt-3 flex gap-2">
            <textarea value={replyBody} onChange={(e) => setReplyBody(e.target.value)} rows={2}
              placeholder="Reply to the seller..."
              className="flex-1 resize-none rounded-sm border border-white/10 bg-ink px-3 py-2 text-xs text-cream focus:border-brass focus:outline-none" />
            <button onClick={sendReply} disabled={sending || !replyBody.trim()}
              className="rounded-sm bg-brass/20 border border-brass/30 px-3 py-2 text-xs font-medium text-brass hover:bg-brass/30 disabled:opacity-50 transition self-end">
              Reply
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => setResolving("lift")}
              className="rounded-sm border border-emerald-500/30 px-3 py-1.5 text-xs text-emerald-300 hover:bg-emerald-500/10 transition">
              Approve — Lift enforcement
            </button>
            <button onClick={() => setResolving("uphold")}
              className="rounded-sm border border-red-500/30 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10 transition">
              Deny — Uphold decision
            </button>
          </div>

          {resolving && (
            <div className="mt-2 flex flex-col gap-2 rounded-sm border border-white/[0.08] bg-ink p-3">
              <p className="text-xs text-slate">
                {resolving === "lift" ? "Reinstating this seller. " : "Upholding the original decision. "}
                Explain your reasoning (min 10 chars) — the seller will see this:
              </p>
              <textarea value={resolutionNote} onChange={(e) => setResolutionNote(e.target.value)} rows={2}
                className="resize-none rounded-sm border border-white/10 bg-surface px-3 py-2 text-xs text-cream focus:border-brass focus:outline-none" />
              <div className="flex gap-2">
                <button onClick={submitResolve} disabled={sending || resolutionNote.trim().length < 10}
                  className="rounded-sm bg-brass/20 border border-brass/30 px-3 py-1.5 text-xs font-medium text-brass hover:bg-brass/30 disabled:opacity-50 transition">
                  {sending ? "Submitting…" : "Confirm"}
                </button>
                <button onClick={() => { setResolving(null); setResolutionNote(""); }}
                  className="rounded-sm border border-white/10 px-3 py-1.5 text-xs text-slate hover:text-cream transition">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function AdminAppealsPage() {
  const [items, setItems] = useState<AppealListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("open");
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/admin/appeals?status=${statusFilter}&pageSize=25`);
      const json = await res.json();
      if (!res.ok) { setError(json.error?.message ?? "Could not load appeals."); return; }
      setItems(json.items ?? []); setTotal(json.total ?? 0);
    } catch { setError("Network error."); }
    finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl text-cream">Seller Appeals</h1>
        <span className="text-sm text-slate">{total} total</span>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {["open", "resolved_lifted", "resolved_upheld", "all"].map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`rounded-sm border px-3 py-1.5 text-xs capitalize transition ${
              statusFilter === s ? "border-brass bg-brass/10 text-brass font-medium" : "border-white/10 text-slate hover:text-cream"
            }`}>
            {s === "open" ? "Needs attention" : s.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      {error && <p className="mb-4 rounded-sm border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}

      {loading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-24 animate-pulse rounded-sm bg-surface" />)}</div>
      ) : items.length === 0 ? (
        <p className="py-12 text-center text-sm text-slate">No appeals in this view.</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const lastMsg = item.messages[0];
            return (
              <div key={item.id} className="rounded-sm border border-white/[0.08] bg-surface p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className={`rounded-sm border px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[item.status] ?? ""}`}>
                        {item.status.replace(/_/g, " ")}
                      </span>
                      <span className="text-xs text-slate/60 capitalize">
                        seller {item.seller.status}
                      </span>
                    </div>
                    <p className="font-medium text-cream">{item.seller.displayName ?? "Unnamed seller"}</p>
                    <p className="text-xs text-slate">{item.seller.businessEmail}</p>
                    {item.seller.banReason && (
                      <p className="mt-1 text-xs text-slate/70">Reason: {item.seller.banReason}</p>
                    )}
                    {lastMsg && (
                      <p className="mt-2 text-xs text-slate/60 truncate">
                        Latest: <span className="capitalize">{lastMsg.senderRole}</span> — {lastMsg.body}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <span className="text-xs text-slate/50">
                      {new Date(item.updatedAt).toLocaleDateString()}
                    </span>
                    <button
                      onClick={() => setExpanded(expanded === item.id ? null : item.id)}
                      className="rounded-sm border border-white/10 px-3 py-1.5 text-xs text-slate hover:text-cream transition"
                    >
                      {expanded === item.id ? "Close ▲" : "Open thread ▼"}
                    </button>
                  </div>
                </div>

                {expanded === item.id && (
                  <ThreadDetail appealId={item.id} onChanged={load} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </AdminLayout>
  );
}
