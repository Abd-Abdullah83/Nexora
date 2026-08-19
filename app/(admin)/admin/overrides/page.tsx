"use client";

import { useEffect, useState, useCallback } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";

interface OverrideItem {
  id: string;
  resourceType: string;
  resourceId: string;
  action: string;
  reason: string;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
  createdAt: string;
  admin: { fullName: string; email: string };
}

interface OverridesData { items: OverrideItem[]; total: number; page: number; totalPages: number; }

const ACTION_STYLES: Record<string, string> = {
  order_force_complete:     "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  order_force_cancel:       "bg-red-500/10 text-red-300 border-red-500/20",
  escrow_manual_release:    "bg-blue-500/10 text-blue-300 border-blue-500/20",
  escrow_manual_unfreeze:   "bg-amber-500/10 text-amber-300 border-amber-500/20",
  listing_force_archive:    "bg-orange-500/10 text-orange-300 border-orange-500/20",
  listing_force_reactivate: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
};

export default function AdminOverridesPage() {
  const [data, setData] = useState<OverridesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resourceTypeFilter, setResourceTypeFilter] = useState("all");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "25" });
      if (resourceTypeFilter !== "all") params.set("resourceType", resourceTypeFilter);
      const res = await fetch(`/api/admin/overrides?${params}`);
      const json = await res.json();
      if (!res.ok) { setError(json.error?.message ?? "Could not load overrides."); return; }
      setData(json);
    } catch { setError("Network error."); }
    finally { setLoading(false); }
  }, [page, resourceTypeFilter]);

  useEffect(() => { load(); }, [load]);

  const totalPages = data?.totalPages ?? 1;

  return (
    <AdminLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl text-cream">Override History</h1>
          <p className="mt-1 text-sm text-slate">
            Every manual admin intervention — immutable, fully audited.
          </p>
        </div>
        {data && <span className="text-sm text-slate">{data.total} total</span>}
      </div>

      <div className="mb-5 flex gap-2">
        {["all", "order", "escrow_hold", "listing"].map((t) => (
          <button key={t} onClick={() => { setResourceTypeFilter(t); setPage(1); }}
            className={`rounded-sm border px-3 py-1.5 text-xs capitalize transition ${
              resourceTypeFilter === t
                ? "border-brass bg-brass/10 text-brass font-medium"
                : "border-white/10 text-slate hover:text-cream"
            }`}>
            {t === "all" ? "All" : t.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      {error && (
        <p className="mb-4 rounded-sm border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>
      )}

      {loading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => <div key={i} className="h-20 animate-pulse rounded-sm bg-surface" />)}
        </div>
      ) : !data?.items.length ? (
        <div className="py-20 text-center">
          <p className="text-slate">No override records found.</p>
          <p className="mt-1 text-xs text-slate/60">
            Override records are created when admins manually force-complete orders,
            release escrow holds, or archive/reactivate listings.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.items.map((item) => (
            <div key={item.id} className="rounded-sm border border-white/[0.08] bg-surface p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <span className={`rounded-sm border px-2 py-0.5 text-xs font-medium capitalize ${
                      ACTION_STYLES[item.action] ?? "bg-white/5 text-slate border-white/10"
                    }`}>
                      {item.action.replace(/_/g, " ")}
                    </span>
                    <span className="text-xs text-slate/60 capitalize">
                      {item.resourceType.replace(/_/g, " ")}
                    </span>
                  </div>
                  <p className="font-mono text-xs text-cream/60 mb-1">{item.resourceId}</p>
                  <p className="text-sm text-cream">{item.reason}</p>
                  <div className="mt-1.5 flex items-center gap-3 text-xs text-slate">
                    <span>By {item.admin.fullName}</span>
                    <span>·</span>
                    <span>{new Date(item.createdAt).toLocaleString("en-PK")}</span>
                  </div>
                  {(item.beforeState || item.afterState) && (
                    <div className="mt-2 flex gap-4 text-xs">
                      {item.beforeState && (
                        <span className="text-slate/60">
                          Before: <span className="text-cream/70">{JSON.stringify(item.beforeState)}</span>
                        </span>
                      )}
                      {item.afterState && (
                        <span className="text-slate/60">
                          After: <span className="text-cream/70">{JSON.stringify(item.afterState)}</span>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-5 flex items-center justify-center gap-2">
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
