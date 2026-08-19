"use client";

import { useEffect, useState, useCallback } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";

interface QueueItem {
  id: string;
  docType: string;
  createdAt: string;
  previewUrl: string;
  seller: {
    id: string;
    sellerType: "individual" | "business";
    displayName: string | null;
    businessEmail: string | null;
  };
}

interface QueueResponse {
  items: QueueItem[];
  total: number;
  page: number;
  pageSize: number;
}

const DOC_LABELS: Record<string, string> = {
  national_id: "National ID",
  passport: "Passport",
  business_registration: "Business Registration Certificate",
  trade_license: "Trade License",
  tax_certificate: "Tax Certificate",
};

function getCsrf(): string {
  return (
    document.cookie
      .split("; ")
      .find((c) => c.startsWith("csrf_token="))
      ?.split("=")[1] ?? ""
  );
}

export default function AdminVerificationsPage() {
  const [data, setData] = useState<QueueResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [acting, setActing] = useState<Record<string, boolean>>({});
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/verifications/queue?page=${page}&pageSize=20`);
      const json = await res.json();
      setData(json);
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
      const res = await fetch(`/api/admin/verifications/${id}/approve`, {
        method: "POST",
        headers: { "x-csrf-token": getCsrf() },
      });
      const json = await res.json();
      if (!res.ok) {
        setActionError(json.error?.message ?? "Could not approve this document.");
        return;
      }
      setData((d) => (d ? { ...d, items: d.items.filter((i) => i.id !== id), total: d.total - 1 } : d));
    } finally {
      setActing((m) => {
        const n = { ...m };
        delete n[id];
        return n;
      });
    }
  }

  async function reject(id: string) {
    if (!rejectReason.trim()) {
      setActionError("Enter a reason before rejecting.");
      return;
    }
    setActing((m) => ({ ...m, [id]: true }));
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/verifications/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrf() },
        body: JSON.stringify({ rejectionReason: rejectReason.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        setActionError(json.error?.message ?? "Could not reject this document.");
        return;
      }
      setData((d) => (d ? { ...d, items: d.items.filter((i) => i.id !== id), total: d.total - 1 } : d));
      setRejectingId(null);
      setRejectReason("");
    } finally {
      setActing((m) => {
        const n = { ...m };
        delete n[id];
        return n;
      });
    }
  }

  const items = data?.items ?? [];
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl text-cream">Seller Verifications</h1>
        <span className="text-sm text-slate">{data?.total ?? 0} pending review</span>
      </div>

      <p className="mb-6 text-sm text-slate/70">
        Each card is one submitted document. Approving every required document for a seller
        activates their account; rejecting one sends the seller back to the KYC step to fix and
        re-upload just that document.
      </p>

      {actionError && (
        <p className="mb-4 rounded-sm border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          {actionError}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-slate">Loading...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate">No documents waiting for review.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {items.map((item) => (
            <div key={item.id} className="rounded-sm border border-white/[0.08] bg-surface p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-cream">
                      {DOC_LABELS[item.docType] ?? item.docType}
                    </span>
                    <span className="rounded-sm bg-white/[0.06] px-2 py-0.5 text-xs capitalize text-slate">
                      {item.seller.sellerType}
                    </span>
                  </div>
                  <p className="text-sm text-slate">
                    {item.seller.displayName ?? "Unnamed seller"}
                    {item.seller.businessEmail && (
                      <span className="text-slate/60"> — {item.seller.businessEmail}</span>
                    )}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate/60">
                    <span>Submitted {new Date(item.createdAt).toLocaleString()}</span>
                    <a
                      href={item.previewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brass underline hover:text-brass/80"
                    >
                      Open document (link expires in 5 minutes)
                    </a>
                  </div>
                </div>

                <div className="flex flex-col gap-2 flex-shrink-0">
                  <button
                    onClick={() => approve(item.id)}
                    disabled={acting[item.id]}
                    className="rounded-sm bg-emerald-600/20 px-3 py-1.5 text-xs text-emerald-300 transition hover:bg-emerald-600/40 disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => {
                      setRejectingId(item.id);
                      setRejectReason("");
                      setActionError(null);
                    }}
                    disabled={acting[item.id]}
                    className="rounded-sm bg-red-600/20 px-3 py-1.5 text-xs text-red-300 transition hover:bg-red-600/40 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>

              {rejectingId === item.id && (
                <div className="mt-4 flex flex-col gap-2 border-t border-white/[0.08] pt-4">
                  <label className="text-xs text-slate">
                    Reason shown to the seller (e.g. "Photo is blurry — please re-scan in good
                    lighting")
                  </label>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    rows={2}
                    className="rounded-sm border border-white/10 bg-ink px-3 py-2 text-sm text-cream outline-none focus:border-brass"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => reject(item.id)}
                      disabled={acting[item.id]}
                      className="rounded-sm bg-red-600/30 px-3 py-1.5 text-xs text-red-200 transition hover:bg-red-600/50 disabled:opacity-50"
                    >
                      Confirm rejection
                    </button>
                    <button
                      onClick={() => setRejectingId(null)}
                      className="rounded-sm border border-white/10 px-3 py-1.5 text-xs text-slate hover:text-cream"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-sm border border-white/10 px-3 py-1.5 text-xs text-slate disabled:opacity-40 hover:text-cream"
          >
            ← Prev
          </button>
          <span className="text-xs text-slate">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="rounded-sm border border-white/10 px-3 py-1.5 text-xs text-slate disabled:opacity-40 hover:text-cream"
          >
            Next →
          </button>
        </div>
      )}
    </AdminLayout>
  );
}
