"use client";
// app/(admin)/admin/category-requests/page.tsx
// Admin queue for seller-submitted category requests. Approve creates the
// real Category (via lib/admin/category-request.service.ts, which reuses
// the existing createCategory() repository function). Reject requires a
// note explaining why.

import { useEffect, useState, useCallback } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";

interface CategoryRequestRow {
  id: string;
  name: string;
  description: string | null;
  status: "pending" | "approved" | "rejected";
  resolutionNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
  seller: { id: string; displayName: string | null; businessEmail: string | null; store: { name: string } | null };
  parent: { name: string } | null;
  resolvedCategory: { id: string; name: string; slug: string } | null;
}

const STATUS_STYLES: Record<string, string> = {
  pending:  "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
};

function getCsrf() {
  return document.cookie.split("; ").find((c) => c.startsWith("csrf_token="))?.split("=")[1] ?? "";
}

export default function AdminCategoryRequestsPage() {
  const [items, setItems]           = useState<CategoryRequestRow[]>([]);
  const [loading, setLoading]       = useState(true);
  const [statusFilter, setStatus]   = useState("pending");
  const [acting, setActing]         = useState<Record<string, boolean>>({});
  const [noteMap, setNoteMap]       = useState<Record<string, string>>({});
  const [error, setError]           = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/category-requests?status=${statusFilter}`);
    const data = await res.json();
    setItems(data.items ?? []);
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function resolve(id: string, action: "approve" | "reject") {
    if (action === "reject" && !(noteMap[id] ?? "").trim()) {
      setError("A note is required when rejecting a category request.");
      return;
    }
    setActing((a) => ({ ...a, [id]: true }));
    setError(null);
    try {
      const res = await fetch(`/api/admin/category-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrf() },
        body: JSON.stringify({ action, note: noteMap[id] ?? undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error?.message ?? "Action failed."); return; }
      load();
    } finally {
      setActing((a) => ({ ...a, [id]: false }));
    }
  }

  return (
    <AdminLayout>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl text-cream">Category Requests</h1>
      </div>

      <div className="mb-6 flex gap-2">
        {["pending", "approved", "rejected"].map((s) => (
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
      ) : items.length === 0 ? (
        <div className="rounded-sm border border-white/[0.08] bg-surface p-10 text-center">
          <p className="text-sm text-slate">No {statusFilter} category requests.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {items.map((r) => (
            <div key={r.id} className="rounded-sm border border-white/[0.08] bg-surface p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLES[r.status]}`}>
                      {r.status}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-cream">{r.name}</p>
                  {r.parent && <p className="text-xs text-slate/70">Suggested parent: {r.parent.name}</p>}
                  {r.description && (
                    <p className="mt-2 text-sm text-slate/80 border-l-2 border-brass/40 pl-3">{r.description}</p>
                  )}
                  <p className="mt-2 text-xs text-slate/60">
                    Requested by {r.seller.displayName ?? r.seller.businessEmail ?? "Unknown seller"}
                    {r.seller.store?.name && ` (${r.seller.store.name})`}
                  </p>
                  <p className="mt-1 text-xs text-slate/40">
                    {new Date(r.createdAt).toLocaleDateString()}
                    {r.resolvedAt && ` · Resolved ${new Date(r.resolvedAt).toLocaleDateString()}`}
                  </p>
                  {r.status === "rejected" && r.resolutionNote && (
                    <p className="mt-1 text-xs text-red-400 italic">Reason: {r.resolutionNote}</p>
                  )}
                  {r.status === "approved" && r.resolvedCategory && (
                    <p className="mt-1 text-xs text-emerald-400">
                      Created as "{r.resolvedCategory.name}" (/{r.resolvedCategory.slug})
                    </p>
                  )}
                </div>

                {r.status === "pending" && (
                  <div className="flex flex-col gap-2 flex-shrink-0 min-w-[220px]">
                    <input
                      type="text"
                      placeholder="Note (required if rejecting)"
                      value={noteMap[r.id] ?? ""}
                      onChange={(e) => setNoteMap((m) => ({ ...m, [r.id]: e.target.value }))}
                      className="w-full rounded-sm border border-white/10 bg-ink/40 px-3 py-1.5 text-xs text-cream outline-none focus:border-brass/50"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => resolve(r.id, "approve")}
                        disabled={acting[r.id]}
                        className="flex-1 rounded-sm bg-emerald-600/20 px-3 py-1.5 text-xs text-emerald-300 hover:bg-emerald-600/40 disabled:opacity-50 transition"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => resolve(r.id, "reject")}
                        disabled={acting[r.id]}
                        className="flex-1 rounded-sm bg-red-600/20 px-3 py-1.5 text-xs text-red-300 hover:bg-red-600/40 disabled:opacity-50 transition"
                      >
                        Reject
                      </button>
                    </div>
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
