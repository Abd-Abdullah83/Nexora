"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { AdminLayout } from "@/components/admin/AdminLayout";

function getCsrf() {
  return document.cookie.split("; ").find((c) => c.startsWith("csrf_token="))?.split("=")[1] ?? "";
}

interface AlertItem {
  id: string;
  matchedSellerId: string;
  matchedIdentityType: string;
  status: string;
  adminNote: string | null;
  resolvedAt: string | null;
  createdAt: string;
  newSeller: {
    id: string;
    displayName: string | null;
    sellerType: string;
    businessEmail: string | null;
    status: string;
  };
}

interface AlertsData {
  items: AlertItem[];
  total: number;
  page: number;
  totalPages: number;
}

function ApprovePanel({ alert, onDone }: { alert: AlertItem; onDone: () => void }) {
  const [note, setNote] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setWorking(true); setError(null);
    const res = await fetch(`/api/admin/ban-evasion-alerts/${alert.id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-csrf-token": getCsrf() },
      body: JSON.stringify({ adminNote: note }),
    });
    const json = await res.json();
    setWorking(false);
    if (!res.ok) { setError(json.error?.message ?? "Action failed."); return; }
    onDone();
  }

  return (
    <form onSubmit={submit} className="mt-3 rounded-sm border border-white/[0.06] bg-ink/60 p-4">
      <p className="mb-2 text-xs font-medium text-cream">Approve — not ban evasion</p>
      <p className="mb-3 text-xs text-slate">
        Document why you believe this is a legitimate match (e.g. different family member,
        corrected data entry error). This note is written permanently to the audit log.
      </p>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3}
        placeholder="Your reasoning (min 10 chars)..."
        className="w-full resize-none rounded-sm border border-white/10 bg-surface px-3 py-2 text-xs text-cream focus:border-brass focus:outline-none" />
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
      <div className="mt-2 flex gap-2">
        <button type="submit" disabled={working || note.trim().length < 10}
          className="rounded-sm bg-brass/20 border border-brass/30 px-4 py-1.5 text-xs font-medium text-brass hover:bg-brass/30 disabled:opacity-50 transition">
          {working ? "Approving…" : "Confirm — not ban evasion"}
        </button>
        <Link href={`/admin/sellers/${alert.newSeller.id}/ban`}
          className="rounded-sm border border-red-500/30 px-4 py-1.5 text-xs font-medium text-red-300 hover:bg-red-500/10 transition">
          Ban this seller instead →
        </Link>
      </div>
    </form>
  );
}

export default function AdminBanEvasionAlertsPage() {
  const [data, setData] = useState<AlertsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [approving, setApproving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/admin/ban-evasion-alerts?page=${page}&pageSize=20`);
      const json = await res.json();
      if (!res.ok) { setError(json.error?.message ?? "Could not load alerts."); return; }
      setData(json);
    } catch { setError("Network error."); }
    finally { setLoading(false); }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const totalPages = data?.totalPages ?? 1;

  return (
    <AdminLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl text-cream">Ban Evasion Alerts</h1>
          <p className="mt-1 text-sm text-slate">
            Identity hash matches against banned sellers — review before activation.
          </p>
        </div>
        {data && <span className="text-sm text-slate">{data.total} pending</span>}
      </div>

      <div className="mb-4 rounded-sm border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-300/90">
        <strong className="text-amber-300">How this works:</strong> When a new seller submits KYC documents,
        their identity hashes are compared against all banned sellers. A match here does NOT mean the seller
        is definitely ban-evading — family members, data errors, and shared documents can cause false positives.
        Review each case individually. Approving clears the activation block. Denying leads you to the ban flow.
      </div>

      {error && <p className="mb-4 rounded-sm border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}

      {loading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-24 animate-pulse rounded-sm bg-surface" />)}</div>
      ) : !data?.items.length ? (
        <div className="py-20 text-center">
          <p className="text-slate">No pending ban evasion alerts.</p>
          <p className="mt-1 text-xs text-slate/60">New alerts appear here when KYC submissions match a banned seller's identity hashes.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {data.items.map((alert) => (
            <div key={alert.id} className="rounded-sm border border-red-500/20 bg-surface p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="rounded-sm border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-300">
                      Pending review
                    </span>
                    <span className="text-xs text-slate">
                      Match on: <strong className="text-cream capitalize">{alert.matchedIdentityType.replace(/_/g, " ")}</strong>
                    </span>
                  </div>

                  <p className="font-medium text-cream">
                    {alert.newSeller.displayName ?? "Unnamed seller"}
                    <span className="ml-2 text-xs font-normal text-slate capitalize">({alert.newSeller.sellerType})</span>
                  </p>
                  <p className="text-xs text-slate">{alert.newSeller.businessEmail}</p>
                  <p className="mt-1 text-xs text-slate/70">
                    Alert created: {new Date(alert.createdAt).toLocaleString()}
                  </p>

                  <div className="mt-2 rounded-sm border border-white/[0.06] bg-ink/40 p-2.5 text-xs">
                    <p className="text-slate">Matched banned seller ID:</p>
                    <p className="font-mono text-cream/70 mt-0.5 truncate">{alert.matchedSellerId}</p>
                    <Link href={`/admin/sellers/${alert.matchedSellerId}`}
                      className="mt-1 text-brass hover:text-brassLight underline">
                      View banned seller →
                    </Link>
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Link href={`/admin/sellers/${alert.newSeller.id}`}
                    className="rounded-sm border border-white/10 px-3 py-1.5 text-xs text-slate hover:text-cream transition">
                    View new seller →
                  </Link>
                </div>
              </div>

              {approving === alert.id ? (
                <ApprovePanel alert={alert} onDone={() => { setApproving(null); load(); }} />
              ) : (
                <div className="mt-3 flex gap-2 border-t border-white/[0.06] pt-3">
                  <button onClick={() => setApproving(alert.id)}
                    className="rounded-sm border border-brass/30 px-3 py-1.5 text-xs text-brass hover:bg-brass/10 transition">
                    Approve — not ban evasion
                  </button>
                  <Link href={`/admin/sellers/${alert.newSeller.id}`}
                    className="rounded-sm border border-red-500/30 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10 transition">
                    Review & ban seller →
                  </Link>
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
