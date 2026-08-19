"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useSession } from "@/hooks/useSession";

function getCsrf() {
  return document.cookie.split("; ").find((c) => c.startsWith("csrf_token="))?.split("=")[1] ?? "";
}

interface PendingBanRequest {
  id: string;
  reason: string;
  requestedAt: string;
  requester: { id: string; fullName: string; email: string };
}

interface SellerDetail {
  id: string;
  displayName: string | null;
  sellerType: string;
  status: string;
  businessEmail: string | null;
  businessPhone: string | null;
  bannedAt: string | null;
  banReason: string | null;
  suspendedUntil: string | null;
  createdAt: string;
  user: { email: string; fullName: string; createdAt: string };
  store: { name: string; slug: string; avgRating: number | null; reviewCount: number } | null;
  subscription: { plan: string; status: string; trialEndAt: string } | null;
  verifications: { docType: string; status: string; rejectionReason: string | null; createdAt: string }[];
  identityHashes: { identityType: string; createdAt: string }[];
  banRecords: {
    id: string; action: string; reason: string; suspendedUntil: string | null;
    createdAt: string; admin: { fullName: string; email: string };
  }[];
  // PHASE 11 HARDENING: pending ban request, if any (at most 1 per seller)
  banRequests: PendingBanRequest[];
  banEvasionAlerts: { id: string; matchedSellerId: string; matchedIdentityType: string; createdAt: string }[];
  wallet: { availableBalance: string; pendingBalance: string; currency: string } | null;
  _count: { products: number; orderItems: number; payoutRequests: number };
}

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  suspended: "bg-orange-500/10 text-orange-300 border-orange-500/20",
  banned: "bg-red-500/10 text-red-300 border-red-500/20",
  pending_approval: "bg-amber-500/10 text-amber-300 border-amber-500/20",
};

function ActionModal({
  sellerId,
  action,
  onDone,
  onClose,
}: {
  sellerId: string;
  action: "ban" | "suspend" | "reinstate";
  onDone: () => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [suspendedUntil, setSuspendedUntil] = useState("");
  const [confirmBan, setConfirmBan] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (action === "ban" && !confirmBan) { setError("Check the confirmation box to proceed."); return; }
    setWorking(true); setError(null);
    const body: Record<string, unknown> = { reason };
    if (action === "suspend" && suspendedUntil) body.suspendedUntil = new Date(suspendedUntil).toISOString();
    const res = await fetch(`/api/admin/sellers/${sellerId}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-csrf-token": getCsrf() },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    setWorking(false);
    if (!res.ok) { setError(json.error?.message ?? "Action failed."); return; }
    onDone();
  }

  // PHASE 11 HARDENING: "ban" no longer executes immediately — it creates
  // a request. Copy updated to reflect that; the irreversibility warning
  // has moved to the confirm step below, where it actually applies.
  const titles = { ban: "Request Permanent Ban", suspend: "Suspend Seller", reinstate: "Reinstate Seller" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-full max-w-md rounded-sm border border-white/10 bg-surface p-6 shadow-xl">
        <h3 className="font-display text-lg text-cream mb-1">{titles[action]}</h3>
        {action === "ban" && (
          <p className="text-xs text-amber-300 mb-4">
            This creates a ban request — a different admin must confirm it before the seller is
            actually banned. Nothing happens to the seller's account until then.
          </p>
        )}
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-xs text-slate">Reason (required, min 10 chars)</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
              placeholder="Document the reason clearly — this is written to the audit log..."
              className="w-full resize-none rounded-sm border border-white/10 bg-ink px-3 py-2 text-sm text-cream focus:border-brass focus:outline-none" />
          </div>
          {action === "suspend" && (
            <div>
              <label className="mb-1 block text-xs text-slate">Suspend until (leave blank = indefinite)</label>
              <input type="datetime-local" value={suspendedUntil} onChange={(e) => setSuspendedUntil(e.target.value)}
                className="rounded-sm border border-white/10 bg-ink px-3 py-1.5 text-xs text-cream focus:border-brass focus:outline-none" />
            </div>
          )}
          {action === "ban" && (
            <label className="flex items-center gap-2 text-sm text-cream cursor-pointer">
              <input type="checkbox" checked={confirmBan} onChange={(e) => setConfirmBan(e.target.checked)}
                className="rounded" />
              I've reviewed this and want to request a ban for this seller.
            </label>
          )}
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="submit"
              disabled={working || reason.trim().length < 10 || (action === "ban" && !confirmBan)}
              className={`rounded-sm px-5 py-2 text-sm font-semibold transition disabled:opacity-50 ${
                action === "ban" ? "bg-amber-700 text-white hover:bg-amber-600" :
                action === "suspend" ? "bg-orange-700 text-white hover:bg-orange-600" :
                "bg-brass text-ink hover:bg-brassLight"
              }`}>
              {working ? "Working…" : titles[action]}
            </button>
            <button type="button" onClick={onClose}
              className="rounded-sm border border-white/10 px-5 py-2 text-sm text-slate hover:text-cream transition">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// PHASE 11 HARDENING: panel shown in place of the plain "Ban" button
// whenever a request is pending. Behaviour branches on whether the
// CURRENT admin is the one who made the request — but this is a UI
// courtesy only; confirmSellerBan() re-checks this server-side against
// the real session regardless of what this component does.
function PendingBanRequestPanel({
  sellerId,
  request,
  currentAdminId,
  onDone,
}: {
  sellerId: string;
  request: PendingBanRequest;
  currentAdminId: string | undefined;
  onDone: () => void;
}) {
  const [working, setWorking] = useState<"confirm" | "cancel" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isOwnRequest = currentAdminId === request.requester.id;

  async function act(action: "confirm" | "cancel") {
    setWorking(action);
    setError(null);
    const res = await fetch(`/api/admin/sellers/${sellerId}/ban-request/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-csrf-token": getCsrf() },
      body: JSON.stringify({}),
    });
    const json = await res.json();
    setWorking(null);
    if (!res.ok) { setError(json.error?.message ?? `Could not ${action} the request.`); return; }
    onDone();
  }

  return (
    <div className="rounded-sm border border-amber-500/30 bg-amber-500/5 p-4">
      <p className="text-sm font-medium text-amber-300">⚠ Ban request pending</p>
      <p className="mt-1 text-sm text-cream">{request.reason}</p>
      <p className="mt-1 text-xs text-slate">
        Requested by {request.requester.fullName} ({request.requester.email}) ·{" "}
        {new Date(request.requestedAt).toLocaleString()}
      </p>

      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

      <div className="mt-3 flex gap-2">
        {isOwnRequest ? (
          <>
            <span className="rounded-sm border border-white/10 px-3 py-1.5 text-xs text-slate">
              Awaiting a different admin's confirmation — you requested this, so you can't confirm it yourself.
            </span>
            <button onClick={() => act("cancel")} disabled={working !== null}
              className="rounded-sm border border-white/20 px-4 py-1.5 text-xs text-cream hover:border-white/40 transition disabled:opacity-50">
              {working === "cancel" ? "…" : "Cancel Request"}
            </button>
          </>
        ) : (
          <>
            <button onClick={() => act("confirm")} disabled={working !== null}
              className="rounded-sm bg-red-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-red-600 transition disabled:opacity-50">
              {working === "confirm" ? "Banning…" : "Confirm Ban — this is permanent"}
            </button>
            <button onClick={() => act("cancel")} disabled={working !== null}
              className="rounded-sm border border-white/20 px-4 py-1.5 text-xs text-cream hover:border-white/40 transition disabled:opacity-50">
              {working === "cancel" ? "…" : "Decline"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function AdminSellerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user: currentAdmin } = useSession();
  const [seller, setSeller] = useState<SellerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<"ban" | "suspend" | "reinstate" | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/sellers/${id}`);
    const json = await res.json();
    setLoading(false);
    if (!res.ok) { setError(json.error?.message ?? "Could not load seller."); return; }
    setSeller(json.seller);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <AdminLayout><div className="h-64 animate-pulse rounded-sm bg-surface" /></AdminLayout>;
  if (error || !seller) return <AdminLayout><p className="text-red-400">{error ?? "Seller not found."}</p></AdminLayout>;

  const pendingBanRequest = seller.banRequests[0] ?? null;
  const canBan       = seller.status !== "banned" && !pendingBanRequest;
  const canSuspend   = seller.status === "active";
  const canReinstate = ["banned", "suspended"].includes(seller.status);

  return (
    <AdminLayout>
      {modal && (
        <ActionModal sellerId={seller.id} action={modal}
          onDone={() => { setModal(null); load(); }}
          onClose={() => setModal(null)} />
      )}

      <div className="mb-6 flex items-start justify-between">
        <div>
          <Link href="/admin/sellers" className="text-xs text-slate hover:text-cream">← Back to sellers</Link>
          <h1 className="mt-2 font-display text-2xl text-cream">{seller.displayName ?? seller.user.fullName}</h1>
          <div className="mt-1 flex items-center gap-2">
            <span className={`rounded-sm border px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[seller.status] ?? "bg-white/5 text-slate border-white/10"}`}>
              {seller.status.replace(/_/g, " ")}
            </span>
            <span className="text-xs text-slate capitalize">{seller.sellerType}</span>
          </div>
        </div>
        <div className="flex gap-2">
          {canSuspend   && <button onClick={() => setModal("suspend")}   className="rounded-sm border border-orange-500/30 px-4 py-2 text-sm text-orange-300 hover:bg-orange-500/10 transition">Suspend</button>}
          {canBan       && <button onClick={() => setModal("ban")}       className="rounded-sm border border-red-500/30 px-4 py-2 text-sm text-red-300 hover:bg-red-500/10 transition">Request Ban</button>}
          {canReinstate && <button onClick={() => setModal("reinstate")} className="rounded-sm border border-emerald-500/30 px-4 py-2 text-sm text-emerald-300 hover:bg-emerald-500/10 transition">Reinstate</button>}
        </div>
      </div>

      {/* PHASE 11 HARDENING: pending ban request panel, shown above everything else when relevant */}
      {pendingBanRequest && (
        <div className="mb-6">
          <PendingBanRequestPanel
            sellerId={seller.id}
            request={pendingBanRequest}
            currentAdminId={currentAdmin?.id}
            onDone={load}
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Identity */}
        <div className="rounded-sm border border-white/[0.08] bg-surface p-5">
          <h2 className="mb-3 text-sm font-medium text-cream">Account</h2>
          <dl className="space-y-1.5 text-sm">
            {[
              ["Full name", seller.user.fullName],
              ["Login email", seller.user.email],
              ["Business email", seller.businessEmail ?? "—"],
              ["Business phone", seller.businessPhone ?? "—"],
              ["Member since", new Date(seller.user.createdAt).toLocaleDateString()],
              ["Listings", String(seller._count.products)],
              ["Order lines", String(seller._count.orderItems)],
              ["Store", seller.store ? `${seller.store.name} · ★ ${seller.store.avgRating?.toFixed(1) ?? "—"} (${seller.store.reviewCount})` : "—"],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <dt className="w-36 flex-shrink-0 text-slate">{k}</dt>
                <dd className="text-cream">{v}</dd>
              </div>
            ))}
            {seller.wallet && (
              <div className="flex gap-2">
                <dt className="w-36 flex-shrink-0 text-slate">Wallet</dt>
                <dd className="text-cream">
                  Available: {seller.wallet.currency} {Number(seller.wallet.availableBalance).toFixed(2)} ·
                  Pending: {seller.wallet.currency} {Number(seller.wallet.pendingBalance).toFixed(2)}
                </dd>
              </div>
            )}
          </dl>
        </div>

        {/* Identity hashes (types only — no raw values ever shown) */}
        <div className="rounded-sm border border-white/[0.08] bg-surface p-5">
          <h2 className="mb-3 text-sm font-medium text-cream">KYC Documents</h2>
          {seller.verifications.length === 0 ? (
            <p className="text-xs text-slate">No documents submitted.</p>
          ) : (
            <div className="space-y-2">
              {seller.verifications.map((v) => (
                <div key={v.docType} className="flex items-center justify-between text-xs">
                  <span className="capitalize text-cream">{v.docType.replace(/_/g, " ")}</span>
                  <span className={`rounded-sm px-2 py-0.5 text-[10px] font-medium ${
                    v.status === "verified" ? "bg-emerald-500/10 text-emerald-300" :
                    v.status === "rejected" ? "bg-red-500/10 text-red-300" : "bg-white/5 text-slate"
                  }`}>{v.status}</span>
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 border-t border-white/[0.06] pt-3">
            <p className="text-xs text-slate">Identity hashes on file: {seller.identityHashes.map((h) => h.identityType.replace(/_/g, " ")).join(", ") || "None"}</p>
          </div>
          {seller.banEvasionAlerts.length > 0 && (
            <div className="mt-3 rounded-sm border border-red-500/30 bg-red-500/10 p-3">
              <p className="text-xs font-medium text-red-300">⚠ {seller.banEvasionAlerts.length} pending ban-evasion alert{seller.banEvasionAlerts.length > 1 ? "s" : ""}</p>
              <Link href="/admin/ban-evasion-alerts" className="mt-1 block text-xs text-red-300/80 underline hover:text-red-200">
                Review alerts →
              </Link>
            </div>
          )}
        </div>

        {/* Ban history */}
        <div className="rounded-sm border border-white/[0.08] bg-surface p-5 lg:col-span-2">
          <h2 className="mb-3 text-sm font-medium text-cream">Enforcement history</h2>
          {seller.banRecords.length === 0 ? (
            <p className="text-xs text-slate">No enforcement actions on record.</p>
          ) : (
            <div className="space-y-2">
              {seller.banRecords.map((r) => (
                <div key={r.id} className="flex items-start gap-4 rounded-sm border border-white/[0.06] p-3 text-xs">
                  <span className={`flex-shrink-0 rounded-sm px-2 py-0.5 font-medium capitalize ${
                    r.action === "banned" ? "bg-red-500/10 text-red-300" :
                    r.action === "suspended" ? "bg-orange-500/10 text-orange-300" :
                    "bg-emerald-500/10 text-emerald-300"
                  }`}>{r.action}</span>
                  <div className="flex-1">
                    <p className="text-cream">{r.reason}</p>
                    <p className="mt-0.5 text-slate">
                      By {r.admin.fullName} · {new Date(r.createdAt).toLocaleString()}
                      {r.suspendedUntil ? ` · Until ${new Date(r.suspendedUntil).toLocaleDateString()}` : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
