"use client";

import { useEffect, useState, useCallback } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";

interface QueueItem {
  id: string;
  status: "held" | "released" | "frozen" | "disputed";
  grossAmount: string;
  deliveredAt: string | null;
  releaseEligibleAt: string | null;
  releasedAt: string | null;
  freezeReason: string | null;
  seller: { id: string; displayName: string | null; sellerType: string };
  orderItem: { id: string; productName: string; orderId: string };
}

interface QueueResponse {
  items: QueueItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const STATUS_STYLES: Record<string, string> = {
  held: "bg-amber-50 text-amber-700 border-amber-200",
  released: "bg-emerald-50 text-emerald-700 border-emerald-200",
  frozen: "bg-red-50 text-red-700 border-red-200",
  disputed: "bg-purple-50 text-purple-700 border-purple-200",
};

function getCsrf(): string {
  return (
    document.cookie
      .split("; ")
      .find((c) => c.startsWith("csrf_token="))
      ?.split("=")[1] ?? ""
  );
}

function daysUntil(dateStr: string | null): string {
  if (!dateStr) return "—";
  const diffMs = new Date(dateStr).getTime() - Date.now();
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (days <= 0) return "Eligible now";
  return `${days} day${days === 1 ? "" : "s"}`;
}

export default function AdminEscrowPage() {
  const [data, setData] = useState<QueueResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [acting, setActing] = useState<Record<string, boolean>>({});
  const [freezingId, setFreezingId] = useState<string | null>(null);
  const [freezeReason, setFreezeReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [jobResult, setJobResult] = useState<{ checked: number; released: number; skipped: unknown[] } | null>(null);
  const [runningJob, setRunningJob] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "25" });
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/admin/escrow/queue?${params}`);
      const json = await res.json();
      setData(json);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  async function submitFreeze(id: string) {
    if (freezeReason.trim().length < 10) {
      setActionError("Please provide a reason of at least 10 characters.");
      return;
    }
    setActing((m) => ({ ...m, [id]: true }));
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/escrow/${id}/hold`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrf() },
        body: JSON.stringify({ reason: freezeReason }),
      });
      const json = await res.json();
      if (!res.ok) {
        setActionError(json.error?.message ?? "Could not freeze this hold.");
        return;
      }
      setFreezingId(null);
      setFreezeReason("");
      await load();
    } finally {
      setActing((m) => ({ ...m, [id]: false }));
    }
  }

  async function unfreeze(id: string) {
    setActing((m) => ({ ...m, [id]: true }));
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/escrow/${id}/unfreeze`, {
        method: "POST",
        headers: { "x-csrf-token": getCsrf() },
      });
      const json = await res.json();
      if (!res.ok) {
        setActionError(json.error?.message ?? "Could not unfreeze this hold.");
        return;
      }
      await load();
    } finally {
      setActing((m) => ({ ...m, [id]: false }));
    }
  }

  async function runReleaseJob() {
    setRunningJob(true);
    setJobResult(null);
    setActionError(null);
    try {
      const res = await fetch("/api/admin/escrow/run-release-job", {
        method: "POST",
        headers: { "x-csrf-token": getCsrf() },
      });
      const json = await res.json();
      if (!res.ok) {
        setActionError(json.error?.message ?? "Release job failed to run.");
        return;
      }
      setJobResult(json);
      await load();
    } finally {
      setRunningJob(false);
    }
  }

  return (
    <AdminLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl text-cream">Escrow Oversight</h1>
          <p className="mt-1 text-sm text-slate">
            All escrow holds across every seller. Releasing is currently triggered manually — see the button below.
          </p>
        </div>
        <button
          onClick={runReleaseJob}
          disabled={runningJob}
          className="rounded-sm bg-gold px-4 py-2 text-sm font-semibold text-ink transition hover:bg-goldLight disabled:opacity-50"
        >
          {runningJob ? "Running…" : "Run Release Job"}
        </button>
      </div>

      {jobResult && (
        <div className="mb-4 rounded-sm border border-emerald-700/40 bg-emerald-900/20 px-4 py-3 text-sm text-emerald-300">
          Checked {jobResult.checked} eligible hold(s), released {jobResult.released}.
          {jobResult.skipped.length > 0 && ` ${jobResult.skipped.length} skipped — see console for details.`}
        </div>
      )}

      {actionError && (
        <div className="mb-4 rounded-sm border border-red-700/40 bg-red-900/20 px-4 py-3 text-sm text-red-300">
          {actionError}
        </div>
      )}

      {/* Status filter */}
      <div className="mb-4 flex gap-2">
        {["", "held", "released", "frozen", "disputed"].map((s) => (
          <button
            key={s || "all"}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`rounded-sm border px-3 py-1.5 text-xs font-medium transition ${
              statusFilter === s
                ? "border-gold bg-gold/10 text-gold"
                : "border-white/10 text-slate hover:text-cream"
            }`}
          >
            {s ? s.charAt(0).toUpperCase() + s.slice(1) : "All"}
          </button>
        ))}
      </div>

      {loading && !data ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse rounded-sm bg-white/5" />)}
        </div>
      ) : !data || data.items.length === 0 ? (
        <p className="rounded-sm border border-white/10 bg-white/[0.02] px-6 py-10 text-center text-sm text-slate">
          No escrow holds match this filter.
        </p>
      ) : (
        <div className="overflow-hidden rounded-sm border border-white/10">
          <table className="w-full text-sm">
            <thead className="border-b border-white/10 bg-white/[0.03] text-left text-xs uppercase tracking-wider text-slate">
              <tr>
                <th className="px-4 py-3">Seller</th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Release / Eligible</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {data.items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 text-cream">
                    {item.seller.displayName ?? "Unnamed"}
                    <span className="ml-1.5 text-xs text-slate">({item.seller.sellerType})</span>
                  </td>
                  <td className="px-4 py-3 text-slate">{item.orderItem.productName}</td>
                  <td className="px-4 py-3 text-cream">{Number(item.grossAmount).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[item.status]}`}>
                      {item.status}
                    </span>
                    {item.status === "frozen" && item.freezeReason && (
                      <p className="mt-1 text-xs text-slate">{item.freezeReason}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate">
                    {item.status === "released"
                      ? item.releasedAt && new Date(item.releasedAt).toLocaleDateString()
                      : daysUntil(item.releaseEligibleAt)}
                  </td>
                  <td className="px-4 py-3">
                    {item.status === "held" && (
                      freezingId === item.id ? (
                        <div className="flex flex-col gap-2">
                          <input
                            value={freezeReason}
                            onChange={(e) => setFreezeReason(e.target.value)}
                            placeholder="Reason (min 10 chars)"
                            className="rounded-sm border border-white/10 bg-white/5 px-2 py-1 text-xs text-cream outline-none"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => submitFreeze(item.id)}
                              disabled={acting[item.id]}
                              className="rounded-sm bg-red-600/80 px-2 py-1 text-xs text-white"
                            >
                              Confirm Freeze
                            </button>
                            <button
                              onClick={() => { setFreezingId(null); setFreezeReason(""); }}
                              className="rounded-sm border border-white/10 px-2 py-1 text-xs text-slate"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setFreezingId(item.id)}
                          className="rounded-sm border border-white/10 px-2 py-1 text-xs text-slate hover:text-cream"
                        >
                          Freeze
                        </button>
                      )
                    )}
                    {item.status === "frozen" && (
                      <button
                        onClick={() => unfreeze(item.id)}
                        disabled={acting[item.id]}
                        className="rounded-sm border border-white/10 px-2 py-1 text-xs text-slate hover:text-cream"
                      >
                        Unfreeze
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && data.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3 text-sm">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-sm border border-white/10 px-3 py-1.5 text-slate disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-slate">Page {data.page} of {data.totalPages}</span>
          <button
            disabled={page >= data.totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-sm border border-white/10 px-3 py-1.5 text-slate disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </AdminLayout>
  );
}
