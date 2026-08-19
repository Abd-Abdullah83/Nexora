"use client";

// app/(admin)/admin/sellers/page.tsx
// Admin seller management — list, search, filter, and enforce actions.
// This is the page the AdminLayout "Sellers" nav link has been waiting
// for since Phase 10 (it was a 404 until this phase).

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { AdminLayout } from "@/components/admin/AdminLayout";

interface SellerRow {
  id: string;
  displayName: string | null;
  sellerType: "individual" | "business";
  status: string;
  businessEmail: string | null;
  bannedAt: string | null;
  banReason: string | null;
  suspendedUntil: string | null;
  createdAt: string;
  user: { email: string; fullName: string };
  store: { name: string; slug: string; avgRating: number | null; reviewCount: number } | null;
  _count: { products: number; orderItems: number; banEvasionAlerts: number };
}

interface ListData {
  sellers: SellerRow[];
  total: number;
  page: number;
  totalPages: number;
}

const STATUS_STYLES: Record<string, string> = {
  active:                      "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  pending_approval:            "bg-amber-500/10  text-amber-300  border-amber-500/20",
  pending_kyc:                 "bg-blue-500/10   text-blue-300   border-blue-500/20",
  pending_email_verification:  "bg-slate/10      text-slate      border-white/10",
  pending_phone_verification:  "bg-slate/10      text-slate      border-white/10",
  suspended:                   "bg-orange-500/10 text-orange-300 border-orange-500/20",
  banned:                      "bg-red-500/10    text-red-300    border-red-500/20",
};

function getCsrf() {
  return document.cookie.split("; ").find((c) => c.startsWith("csrf_token="))?.split("=")[1] ?? "";
}

function QuickActionBar({ seller, onDone }: { seller: SellerRow; onDone: () => void }) {
  const [action, setAction] = useState<"ban" | "suspend" | "reinstate" | null>(null);
  const [reason, setReason] = useState("");
  const [suspendedUntil, setSuspendedUntil] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!action) return;
    setWorking(true);
    setError(null);
    const body: Record<string, unknown> = { reason };
    if (action === "suspend" && suspendedUntil) body.suspendedUntil = new Date(suspendedUntil).toISOString();

    const res = await fetch(`/api/admin/sellers/${seller.id}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-csrf-token": getCsrf() },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    setWorking(false);
    if (!res.ok) { setError(json.error?.message ?? "Action failed."); return; }
    setAction(null);
    setReason("");
    onDone();
  }

  const canBan       = seller.status !== "banned";
  const canSuspend   = seller.status === "active";
  const canReinstate = ["banned", "suspended"].includes(seller.status);

  return (
    <div className="mt-3 border-t border-white/[0.06] pt-3">
      {!action ? (
        <div className="flex flex-wrap gap-2">
          {canSuspend   && <button onClick={() => setAction("suspend")}   className="rounded-sm border border-orange-500/30 px-3 py-1 text-xs text-orange-300 hover:bg-orange-500/10 transition">Suspend</button>}
          {canBan       && <button onClick={() => setAction("ban")}       className="rounded-sm border border-red-500/30 px-3 py-1 text-xs text-red-300 hover:bg-red-500/10 transition">Ban</button>}
          {canReinstate && <button onClick={() => setAction("reinstate")} className="rounded-sm border border-emerald-500/30 px-3 py-1 text-xs text-emerald-300 hover:bg-emerald-500/10 transition">Reinstate</button>}
          <Link href={`/admin/sellers/${seller.id}`} className="rounded-sm border border-white/10 px-3 py-1 text-xs text-slate hover:text-cream transition">Full detail →</Link>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-slate capitalize">{action} — enter reason (min 10 chars)</p>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2}
            placeholder="Document the reason clearly..."
            className="w-full resize-none rounded-sm border border-white/10 bg-ink px-3 py-2 text-xs text-cream focus:border-brass focus:outline-none" />
          {action === "suspend" && (
            <div>
              <label className="mb-1 block text-xs text-slate">Suspend until (leave blank = indefinite)</label>
              <input type="datetime-local" value={suspendedUntil} onChange={(e) => setSuspendedUntil(e.target.value)}
                className="rounded-sm border border-white/10 bg-ink px-3 py-1.5 text-xs text-cream focus:border-brass focus:outline-none" />
            </div>
          )}
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button onClick={submit} disabled={working || reason.trim().length < 10}
              className="rounded-sm bg-brass/20 border border-brass/30 px-3 py-1.5 text-xs font-medium text-brass hover:bg-brass/30 disabled:opacity-50 transition">
              {working ? "Working…" : `Confirm ${action}`}
            </button>
            <button onClick={() => { setAction(null); setError(null); }}
              className="rounded-sm border border-white/10 px-3 py-1.5 text-xs text-slate hover:text-cream transition">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminSellersPage() {
  const [data, setData]               = useState<ListData | null>(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [page, setPage]               = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch]           = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [expanded, setExpanded]       = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch(`/api/admin/sellers?${params}`);
      const json = await res.json();
      if (!res.ok) { setError(json.error?.message ?? "Failed to load sellers."); return; }
      setData(json);
    } catch { setError("Network error."); }
    finally { setLoading(false); }
  }, [page, statusFilter, search]);

  useEffect(() => { load(); }, [load]);

  const totalPages = data?.totalPages ?? 1;

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl text-cream">Sellers</h1>
        <span className="text-sm text-slate">{data?.total ?? 0} total</span>
      </div>

      {/* Filters */}
      <div className="mb-5 flex flex-wrap gap-3">
        <div className="flex gap-1">
          {["all","active","pending_approval","pending_kyc","suspended","banned"].map((s) => (
            <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`rounded-sm border px-3 py-1.5 text-xs capitalize transition ${
                statusFilter === s ? "border-brass bg-brass/10 text-brass font-medium" : "border-white/10 text-slate hover:text-cream"
              }`}>
              {s === "all" ? "All" : s.replace(/_/g, " ")}
            </button>
          ))}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); setSearch(searchInput); setPage(1); }} className="flex gap-2 ml-auto">
          <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search name, email..."
            className="rounded-sm border border-white/10 bg-surface px-3 py-1.5 text-xs text-cream placeholder:text-slate/50 focus:border-brass focus:outline-none w-48" />
          <button type="submit" className="rounded-sm bg-surface border border-white/10 px-3 py-1.5 text-xs text-slate hover:text-cream transition">Search</button>
        </form>
      </div>

      {error && <p className="mb-4 rounded-sm border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}

      {loading ? (
        <div className="space-y-2">{[...Array(6)].map((_,i) => <div key={i} className="h-20 animate-pulse rounded-sm bg-surface"/>)}</div>
      ) : !data?.sellers.length ? (
        <p className="py-12 text-center text-sm text-slate">No sellers found.</p>
      ) : (
        <div className="space-y-2">
          {data.sellers.map((seller) => (
            <div key={seller.id} className="rounded-sm border border-white/[0.08] bg-surface p-4">
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className={`rounded-sm border px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[seller.status] ?? "bg-white/5 text-slate border-white/10"}`}>
                      {seller.status.replace(/_/g, " ")}
                    </span>
                    <span className="text-xs text-slate/60 capitalize">{seller.sellerType}</span>
                    {seller._count.banEvasionAlerts > 0 && (
                      <span className="rounded-sm border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-xs font-bold text-red-300">
                        ⚠ {seller._count.banEvasionAlerts} ban alert{seller._count.banEvasionAlerts > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  <p className="font-medium text-cream">{seller.displayName ?? seller.user.fullName}</p>
                  <p className="text-xs text-slate">{seller.user.email}</p>
                  <p className="mt-1 text-xs text-slate/60">
                    {seller._count.products} listings · {seller._count.orderItems} order lines
                    {seller.store?.avgRating ? ` · ★ ${Number(seller.store.avgRating).toFixed(1)} (${seller.store.reviewCount})` : ""}
                  </p>
                  {seller.banReason && (
                    <p className="mt-1 text-xs text-red-300/80">Ban reason: {seller.banReason}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => setExpanded(expanded === seller.id ? null : seller.id)}
                    className="rounded-sm border border-white/10 px-3 py-1.5 text-xs text-slate hover:text-cream transition"
                  >
                    {expanded === seller.id ? "Close ▲" : "Actions ▼"}
                  </button>
                </div>
              </div>

              {expanded === seller.id && (
                <QuickActionBar seller={seller} onDone={() => { setExpanded(null); load(); }} />
              )}
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
