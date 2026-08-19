"use client";

import { useEffect, useState, useCallback } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";

interface Review {
  id: string;
  title: string | null;
  comment: string;
  rating: number;
  status: string;
  createdAt: string;
  user: { fullName: string; email: string };
  product: { name: string; slug: string };
}

function getCsrf(): string {
  return (
    document.cookie
      .split("; ")
      .find((c) => c.startsWith("csrf_token="))
      ?.split("=")[1] ?? ""
  );
}

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [moderating, setModerating] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status: statusFilter, page: String(page) });
      const res = await fetch(`/api/admin/reviews?${params.toString()}`);
      const data = await res.json();
      setReviews(data.items ?? []);
      setTotalPages(data.totalPages ?? 1);
      setTotal(data.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page]);

  useEffect(() => { load(); }, [load]);

  async function moderate(id: string, status: "approved" | "rejected" | "flagged") {
    setModerating((m) => ({ ...m, [id]: true }));
    try {
      const res = await fetch(`/api/admin/reviews?id=${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": getCsrf(),
        },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setReviews((prev) => prev.filter((r) => r.id !== id));
        setTotal((t) => t - 1);
      }
    } finally {
      setModerating((m) => { const n = { ...m }; delete n[id]; return n; });
    }
  }

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl text-cream">Reviews</h1>
        <span className="text-sm text-slate">{total} reviews</span>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {["pending", "approved", "rejected", "flagged", "all"].map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`rounded-sm px-4 py-2 text-sm capitalize transition ${
              statusFilter === s
                ? "bg-brass text-ink font-semibold"
                : "border border-white/10 text-slate hover:text-cream"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-slate">Loading...</p>
      ) : reviews.length === 0 ? (
        <p className="text-sm text-slate">No reviews with this status.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {reviews.map((review) => (
            <div key={review.id} className="rounded-sm border border-white/[0.08] bg-surface p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {/* Stars */}
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-brass text-sm">
                      {"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}
                    </span>
                    {review.title && (
                      <span className="text-sm font-medium text-cream">{review.title}</span>
                    )}
                  </div>
                  <p className="text-sm text-slate leading-relaxed mb-3">{review.comment}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate/60">
                    <span>By <span className="text-slate">{review.user.fullName}</span></span>
                    <span>On <span className="text-slate">{review.product.name}</span></span>
                    <span>{new Date(review.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 flex-shrink-0">
                  {review.status !== "approved" && (
                    <button
                      onClick={() => moderate(review.id, "approved")}
                      disabled={moderating[review.id]}
                      className="rounded-sm bg-emerald-600/20 px-3 py-1.5 text-xs text-emerald-300 transition hover:bg-emerald-600/40 disabled:opacity-50"
                    >
                      Approve
                    </button>
                  )}
                  {review.status !== "rejected" && (
                    <button
                      onClick={() => moderate(review.id, "rejected")}
                      disabled={moderating[review.id]}
                      className="rounded-sm bg-red-600/20 px-3 py-1.5 text-xs text-red-300 transition hover:bg-red-600/40 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  )}
                  {review.status !== "flagged" && (
                    <button
                      onClick={() => moderate(review.id, "flagged")}
                      disabled={moderating[review.id]}
                      className="rounded-sm bg-yellow-600/20 px-3 py-1.5 text-xs text-yellow-300 transition hover:bg-yellow-600/40 disabled:opacity-50"
                    >
                      Flag
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded-sm border border-white/10 px-3 py-1.5 text-xs text-slate disabled:opacity-40 hover:text-cream">← Prev</button>
          <span className="text-xs text-slate">Page {page} of {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="rounded-sm border border-white/10 px-3 py-1.5 text-xs text-slate disabled:opacity-40 hover:text-cream">Next →</button>
        </div>
      )}
    </AdminLayout>
  );
}