"use client";
// app/(admin)/admin/moderation/page.tsx
// Phase 5 gap fill: Admin listing moderation queue.
// Shows all pending/cleared/rejected moderation flags. Admin can approve
// (clear) or reject a flagged listing from here.

import { useEffect, useState, useCallback } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";

interface ModerationFlag {
  id: string;
  reason: string;
  status: "pending" | "cleared" | "rejected";
  raisedBy: "system" | "admin";
  resolutionNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
  product: {
    id: string;
    name: string;
    slug: string;
    status: string;
    seller: { id: string; store: { name: string } | null } | null;
  };
}

const STATUS_STYLES: Record<string, string> = {
  pending:  "bg-amber-100 text-amber-700",
  cleared:  "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
};

function getCsrf() {
  return document.cookie.split("; ").find((c) => c.startsWith("csrf_token="))?.split("=")[1] ?? "";
}

export default function AdminModerationPage() {
  const [flags, setFlags]         = useState<ModerationFlag[]>([]);
  const [loading, setLoading]     = useState(true);
  const [statusFilter, setStatus] = useState("pending");
  const [acting, setActing]       = useState<Record<string, boolean>>({});
  const [noteMap, setNoteMap]     = useState<Record<string, string>>({});
  const [error, setError]         = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/listings/moderation?status=${statusFilter}`);
    const data = await res.json();
    setFlags(data.flags ?? []);
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function resolve(flagId: string, action: "clear" | "reject") {
    setActing((a) => ({ ...a, [flagId]: true }));
    setError(null);
    try {
      const res = await fetch(`/api/admin/listings/moderation/${flagId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrf() },
        body: JSON.stringify({ action, resolutionNote: noteMap[flagId] ?? "" }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error?.message ?? "Action failed."); return; }
      load();
    } finally {
      setActing((a) => ({ ...a, [flagId]: false }));
    }
  }

  return (
    <AdminLayout>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl text-cream">Listing Moderation</h1>
      </div>

      {/* Status tabs */}
      <div className="mb-6 flex gap-2">
        {["pending", "cleared", "rejected"].map((s) => (
          <button key={s} onClick={() => setStatus(s)}
            className={`rounded-sm px-4 py-2 text-sm capitalize transition ${
              statusFilter === s ? "bg-brass text-ink font-semibold" : "border border-white/10 text-slate hover:text-cream"
            }`}>
            {s}
          </button>
        ))}
      </div>

      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

      {loading ? (
        <p className="text-sm text-slate">Loading…</p>
      ) : flags.length === 0 ? (
        <div className="rounded-sm border border-white/[0.08] bg-surface p-10 text-center">
          <p className="text-sm text-slate">No {statusFilter} flags.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {flags.map((flag) => (
            <div key={flag.id} className="rounded-sm border border-white/[0.08] bg-surface p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLES[flag.status]}`}>
                      {flag.status}
                    </span>
                    <span className="text-xs text-slate/60 capitalize">{flag.raisedBy} flagged</span>
                  </div>
                  <p className="text-sm font-medium text-cream">{flag.product.name}</p>
                  <p className="text-xs text-slate mt-0.5">
                    Store: {flag.product.seller?.store?.name ?? "Unknown"} ·
                    Product status: <span className="capitalize">{flag.product.status}</span>
                  </p>
                  <p className="mt-2 text-sm text-slate/80 border-l-2 border-red-400/40 pl-3">
                    {flag.reason}
                  </p>
                  {flag.resolutionNote && (
                    <p className="mt-1 text-xs text-slate/60 italic">
                      Resolution note: {flag.resolutionNote}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-slate/40">
                    Flagged {new Date(flag.createdAt).toLocaleDateString()}
                    {flag.resolvedAt && ` · Resolved ${new Date(flag.resolvedAt).toLocaleDateString()}`}
                  </p>
                </div>

                {flag.status === "pending" && (
                  <div className="flex flex-col gap-2 flex-shrink-0 min-w-[200px]">
                    <input
                      type="text"
                      placeholder="Resolution note (optional)"
                      value={noteMap[flag.id] ?? ""}
                      onChange={(e) => setNoteMap((m) => ({ ...m, [flag.id]: e.target.value }))}
                      className="w-full rounded-sm border border-white/10 bg-ink/40 px-3 py-1.5 text-xs text-cream outline-none focus:border-brass/50"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => resolve(flag.id, "clear")}
                        disabled={acting[flag.id]}
                        className="flex-1 rounded-sm bg-emerald-600/20 px-3 py-1.5 text-xs text-emerald-300 hover:bg-emerald-600/40 disabled:opacity-50 transition"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => resolve(flag.id, "reject")}
                        disabled={acting[flag.id]}
                        className="flex-1 rounded-sm bg-red-600/20 px-3 py-1.5 text-xs text-red-300 hover:bg-red-600/40 disabled:opacity-50 transition"
                      >
                        Reject
                      </button>
                    </div>
                    <a
                      href={`/product/${flag.product.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-center text-xs text-brass hover:underline"
                    >
                      View listing →
                    </a>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}
