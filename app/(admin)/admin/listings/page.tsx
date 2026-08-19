"use client";

import { useEffect, useState, useCallback } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";

interface QueueItem {
  id: string;
  name: string;
  slug: string;
  price: string;
  sku: string | null;
  createdAt: string;
  seller: { id: string; displayName: string | null; approvedListingCount: number };
  category: { name: string };
  images: { url: string; altText: string | null }[];
}

interface QueueResponse {
  items: QueueItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

function getCsrf(): string {
  return (
    document.cookie
      .split("; ")
      .find((c) => c.startsWith("csrf_token="))
      ?.split("=")[1] ?? ""
  );
}

export default function AdminListingReviewPage() {
  const [data, setData] = useState<QueueResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [acting, setActing] = useState<Record<string, boolean>>({});
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setActionError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      const res = await fetch(`/api/admin/listings/queue?${params}`);
      const json = await res.json();
      if (!res.ok) {
        setActionError(json.error?.message ?? "Failed to load queue.");
        setData(null);
      } else {
        setData(json);
      }
    } catch (err: any) {
      setActionError(err.message ?? "An error occurred.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  async function approve(id: string) {
    setActing((m) => ({ ...m, [id]: true }));
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/listings/${id}/approve`, {
        method: "POST",
        headers: { "x-csrf-token": getCsrf() },
      });
      const json = await res.json();
      if (!res.ok) {
        setActionError(json.error?.message ?? "Could not approve listing.");
        return;
      }
      await load();
    } finally {
      setActing((m) => ({ ...m, [id]: false }));
    }
  }

  async function submitReject(id: string) {
    if (rejectReason.trim().length < 10) {
      setActionError("Please provide a reason of at least 10 characters.");
      return;
    }
    setActing((m) => ({ ...m, [id]: true }));
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/listings/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrf() },
        body: JSON.stringify({ reason: rejectReason }),
      });
      const json = await res.json();
      if (!res.ok) {
        setActionError(json.error?.message ?? "Could not reject listing.");
        return;
      }
      setRejectingId(null);
      setRejectReason("");
      await load();
    } finally {
      setActing((m) => ({ ...m, [id]: false }));
    }
  }

  async function grantTrust(sellerId: string) {
    setActing((m) => ({ ...m, [`trust-${sellerId}`]: true }));
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/sellers/${sellerId}/trust`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrf() },
        body: JSON.stringify({ action: "grant" }),
      });
      const json = await res.json();
      if (!res.ok) {
        setActionError(json.error?.message ?? "Could not grant trust.");
        return;
      }
      await load();
    } finally {
      setActing((m) => ({ ...m, [`trust-${sellerId}`]: false }));
    }
  }

  return (
    <AdminLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl text-cream">Listing Review</h1>
          <p className="mt-1 text-sm text-slate">
            New seller listings awaiting approval before going live on the storefront.
          </p>
        </div>
        {data && <span className="text-sm text-slate">{data.total} pending</span>}
      </div>

      {actionError && (
        <div className="mb-4 rounded-sm border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400">
          {actionError}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate">Loading…</p>
      ) : !data || !data.items || data.items.length === 0 ? (
        <div className="rounded-sm border border-white/[0.08] bg-surface px-6 py-12 text-center text-sm text-slate">
          No listings waiting for review.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {(data.items || []).map((item) => {
            const seller = item.seller;
            const isAtThreshold = seller.approvedListingCount >= 5;
            return (
              <div
                key={item.id}
                className="rounded-sm border border-white/[0.08] bg-surface p-4"
              >
                <div className="flex items-start gap-4">
                  {/* Image */}
                  <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-sm bg-white/[0.04]">
                    {item.images[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.images[0].url}
                        alt={item.images[0].altText ?? item.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-slate/40">
                        No image
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-cream">{item.name}</h3>
                      <span className="rounded-full border border-white/[0.08] px-2 py-0.5 text-xs text-slate">
                        {item.category.name}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-brass">PKR {Number(item.price).toFixed(2)}</p>
                    <div className="mt-1 flex items-center gap-3 text-xs text-slate">
                      <span>
                        Seller: <span className="text-cream">{seller.displayName ?? "Unnamed"}</span>
                      </span>
                      <span className={isAtThreshold ? "text-emerald-400" : ""}>
                        {seller.approvedListingCount} approved listing{seller.approvedListingCount === 1 ? "" : "s"}
                      </span>
                      {item.sku && <span>SKU: {item.sku}</span>}
                      <span>Submitted {new Date(item.createdAt).toLocaleDateString()}</span>
                    </div>

                    {isAtThreshold && (
                      <button
                        onClick={() => grantTrust(seller.id)}
                        disabled={acting[`trust-${seller.id}`]}
                        className="mt-2 text-xs text-emerald-400 underline hover:text-emerald-300 disabled:opacity-50"
                      >
                        Grant trusted-seller status (skip future reviews)
                      </button>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-shrink-0 gap-2">
                    <button
                      onClick={() => approve(item.id)}
                      disabled={acting[item.id]}
                      className="rounded-sm bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-400 transition hover:bg-emerald-500/25 disabled:opacity-50"
                    >
                      {acting[item.id] ? "…" : "Approve"}
                    </button>
                    <button
                      onClick={() => setRejectingId(rejectingId === item.id ? null : item.id)}
                      className="rounded-sm bg-red-500/15 px-3 py-1.5 text-xs font-medium text-red-400 transition hover:bg-red-500/25"
                    >
                      Reject
                    </button>
                  </div>
                </div>

                {rejectingId === item.id && (
                  <div className="mt-3 border-t border-white/[0.08] pt-3">
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Reason for rejection (visible to the seller)…"
                      className="w-full rounded-sm border border-white/[0.08] bg-ink px-3 py-2 text-sm text-cream placeholder:text-slate/40 focus:border-brass/40 focus:outline-none"
                      rows={2}
                    />
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => submitReject(item.id)}
                        disabled={acting[item.id]}
                        className="rounded-sm bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-300 transition hover:bg-red-500/30 disabled:opacity-50"
                      >
                        Confirm Rejection
                      </button>
                      <button
                        onClick={() => { setRejectingId(null); setRejectReason(""); }}
                        className="rounded-sm border border-white/[0.08] px-3 py-1.5 text-xs text-slate hover:text-cream"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {data && data.totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-3 text-sm">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded-sm border border-white/[0.08] px-3 py-1.5 text-slate disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-slate">Page {data.page} of {data.totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
            disabled={page >= data.totalPages}
            className="rounded-sm border border-white/[0.08] px-3 py-1.5 text-slate disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </AdminLayout>
  );
}
