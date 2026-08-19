"use client";
// app/(admin)/admin/audit-log/page.tsx
//
// Phase 12 gap fill: the audit-log viewer. /api/admin/audit-log has
// existed since Phase 12's original delivery — this is the page that
// actually renders it, which was the one confirmed-missing piece.
// Matches the dark ink/surface/brass admin theme used by every other
// admin page (disputes, payouts, overrides).

import { useState, useEffect, useCallback, Fragment } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";

interface AuditLogEntry {
  id: string;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  ipAddress: string;
  userAgent: string | null;
  createdAt: string;
  user: { fullName: string; email: string; role: string } | null;
}

// Colour-codes the action prefix (buyer./seller./admin./system.) so a
// dense log is scannable at a glance — matches the visual language of
// the status badges used on /admin/disputes and /admin/payouts.
function actionColor(action: string): string {
  if (action.startsWith("admin.")) return "text-brass";
  if (action.startsWith("seller.")) return "text-blue-300";
  if (action.startsWith("buyer.")) return "text-emerald-300";
  if (action.startsWith("system.")) return "text-amber-300";
  return "text-cream";
}

function formatJson(value: Record<string, unknown> | null): string | null {
  if (!value || Object.keys(value).length === 0) return null;
  return JSON.stringify(value);
}

export default function AdminAuditLogPage() {
  const [items, setItems] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filters
  const [actionFilter, setActionFilter] = useState("");
  const [resourceTypeFilter, setResourceTypeFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "50" });
      if (actionFilter.trim()) params.set("action", actionFilter.trim());
      if (resourceTypeFilter.trim()) params.set("resourceType", resourceTypeFilter.trim());
      if (fromDate) params.set("from", new Date(fromDate).toISOString());
      if (toDate) params.set("to", new Date(toDate + "T23:59:59").toISOString());

      const res = await fetch(`/api/admin/audit-log?${params}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error?.message ?? "Could not load the audit log.");
        return;
      }
      setItems(json.items);
      setTotal(json.total);
      setTotalPages(json.totalPages);
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter, resourceTypeFilter, fromDate, toDate]);

  useEffect(() => {
    load();
  }, [load]);

  function applyFilters(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    load();
  }

  function clearFilters() {
    setActionFilter("");
    setResourceTypeFilter("");
    setFromDate("");
    setToDate("");
    setPage(1);
  }

  const hasActiveFilters = actionFilter || resourceTypeFilter || fromDate || toDate;

  return (
    <AdminLayout>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl text-cream">Audit Log</h1>
            <p className="mt-1 text-sm text-slate">
              Every sensitive action across buyers, sellers, and admins — financial and trust &amp; safety events in one place.
            </p>
          </div>
          {!loading && <span className="text-sm text-slate">{total} total</span>}
        </div>

        {/* Filters */}
        <form onSubmit={applyFilters} className="mt-6 flex flex-wrap items-end gap-3 rounded-sm border border-white/10 bg-surface p-4">
          <div>
            <label className="mb-1 block text-xs text-slate">Action contains</label>
            <input
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              placeholder="e.g. payout_paid"
              className="w-44 rounded-sm border border-white/10 bg-ink px-3 py-1.5 text-sm text-cream outline-none focus:border-brass"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate">Resource type</label>
            <input
              value={resourceTypeFilter}
              onChange={(e) => setResourceTypeFilter(e.target.value)}
              placeholder="e.g. dispute"
              className="w-40 rounded-sm border border-white/10 bg-ink px-3 py-1.5 text-sm text-cream outline-none focus:border-brass"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate">From</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="rounded-sm border border-white/10 bg-ink px-3 py-1.5 text-sm text-cream outline-none focus:border-brass"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate">To</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="rounded-sm border border-white/10 bg-ink px-3 py-1.5 text-sm text-cream outline-none focus:border-brass"
            />
          </div>
          <button
            type="submit"
            className="rounded-sm bg-brass px-4 py-1.5 text-sm font-semibold text-ink transition hover:bg-brassLight"
          >
            Apply
          </button>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs text-slate underline hover:text-cream"
            >
              Clear filters
            </button>
          )}
        </form>

        {error && (
          <p className="mt-4 rounded-sm border border-red-500/30 bg-red-900/20 p-3 text-sm text-red-400">
            {error}
          </p>
        )}

        {loading && (
          <div className="mt-6 space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-sm bg-surface" />
            ))}
          </div>
        )}

        {!loading && items.length === 0 && (
          <p className="mt-8 text-sm text-slate">No matching audit log entries.</p>
        )}

        {!loading && items.length > 0 && (
          <div className="mt-6 overflow-hidden rounded-sm border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-surface">
                <tr>
                  {["Time", "Action", "Actor", "Resource", "IP", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 bg-ink">
                {items.map((entry) => {
                  const details = formatJson(entry.oldValues) || formatJson(entry.newValues);
                  const hasDetails = !!(formatJson(entry.oldValues) || formatJson(entry.newValues));
                  const isExpanded = expandedId === entry.id;
                  return (
                    <Fragment key={entry.id}>
                      <tr
                        onClick={() => hasDetails && setExpandedId(isExpanded ? null : entry.id)}
                        className={hasDetails ? "cursor-pointer hover:bg-surface/60 transition" : ""}
                      >
                        <td className="px-4 py-3 text-xs text-slate whitespace-nowrap">
                          {new Date(entry.createdAt).toLocaleString("en-PK")}
                        </td>
                        <td className={`px-4 py-3 font-mono text-xs ${actionColor(entry.action)}`}>
                          {entry.action}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {entry.user ? (
                            <>
                              <p className="text-cream">{entry.user.fullName}</p>
                              <p className="text-slate">{entry.user.role}</p>
                            </>
                          ) : (
                            <span className="text-slate">system</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate">
                          {entry.resourceType ? (
                            <>
                              <span className="capitalize">{entry.resourceType.replace(/_/g, " ")}</span>
                              {entry.resourceId && (
                                <p className="font-mono text-slate/60 truncate max-w-[140px]">{entry.resourceId}</p>
                              )}
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate">{entry.ipAddress}</td>
                        <td className="px-4 py-3 text-xs text-slate">
                          {hasDetails && (isExpanded ? "▲" : "▼ details")}
                        </td>
                      </tr>
                      {isExpanded && hasDetails && (
                        <tr>
                          <td colSpan={6} className="bg-surface/40 px-4 py-3">
                            <div className="grid grid-cols-2 gap-4 text-xs">
                              {formatJson(entry.oldValues) && (
                                <div>
                                  <p className="mb-1 font-medium text-slate">Before</p>
                                  <pre className="whitespace-pre-wrap break-all rounded-sm bg-ink p-2 text-slate/80">
                                    {formatJson(entry.oldValues)}
                                  </pre>
                                </div>
                              )}
                              {formatJson(entry.newValues) && (
                                <div>
                                  <p className="mb-1 font-medium text-slate">
                                    {formatJson(entry.oldValues) ? "After" : "Details"}
                                  </p>
                                  <pre className="whitespace-pre-wrap break-all rounded-sm bg-ink p-2 text-slate/80">
                                    {formatJson(entry.newValues)}
                                  </pre>
                                </div>
                              )}
                            </div>
                            {entry.userAgent && (
                              <p className="mt-2 truncate text-[10px] text-slate/50">{entry.userAgent}</p>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
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
      </div>
    </AdminLayout>
  );
}
