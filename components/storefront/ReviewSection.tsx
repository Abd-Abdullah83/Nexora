"use client";

import { useState, useEffect } from "react";

interface Review {
  id: string;
  rating: number;
  title: string | null;
  comment: string;
  createdAt: string;
  authorName: string;
  helpfulCount: number;
  notHelpfulCount: number;
  userVote: boolean | null;
  isOwnReview: boolean;
}

interface ReviewSectionProps {
  productId: string;
  productSlug: string;
}

function getCsrf(): string {
  return (
    document.cookie
      .split("; ")
      .find((c) => c.startsWith("csrf_token="))
      ?.split("=")[1] ?? ""
  );
}

function StarPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          className="text-2xl transition"
        >
          <span className={star <= (hovered || value) ? "text-gold" : "text-ivoryBorder"}>
            ★
          </span>
        </button>
      ))}
    </div>
  );
}

function ReviewCard({
  review,
  onVote,
  onDelete,
  deleting,
}: {
  review: Review;
  onVote: (reviewId: string, helpful: boolean) => void;
  onDelete: (reviewId: string) => void;
  deleting: boolean;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <div className="rounded-sm border border-ivoryBorder bg-white p-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-gold">
              {"★".repeat(review.rating)}
              <span className="text-ivoryBorder">{"★".repeat(5 - review.rating)}</span>
            </span>
            {review.title && (
              <span className="text-sm font-medium text-charcoal">{review.title}</span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-subtle">
            {review.authorName} ·{" "}
            {new Date(review.createdAt).toLocaleDateString("en-PK", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </p>
        </div>
        <span className="flex-shrink-0 rounded-sm bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-700">
          Verified Purchase
        </span>
      </div>

      {/* Comment */}
      <p className="text-sm text-muted leading-relaxed mb-4">{review.comment}</p>

      {/* Helpfulness voting + delete (own review only) */}
      <div className="flex items-center justify-between gap-3 border-t border-ivoryBorder pt-3">
        <div className="flex items-center gap-3">
          <p className="text-xs text-subtle">Was this helpful?</p>
          <button
            onClick={() => onVote(review.id, true)}
            className={`flex items-center gap-1.5 rounded-sm border px-2.5 py-1 text-xs transition ${
              review.userVote === true
                ? "border-gold/50 bg-gold/10 text-gold"
                : "border-ivoryBorder text-muted hover:border-gold/40 hover:text-charcoal"
            }`}
          >
            👍 {review.helpfulCount}
          </button>
          <button
            onClick={() => onVote(review.id, false)}
            className={`flex items-center gap-1.5 rounded-sm border px-2.5 py-1 text-xs transition ${
              review.userVote === false
                ? "border-red-300 bg-red-50 text-red-600"
                : "border-ivoryBorder text-muted hover:border-red-200 hover:text-red-500"
            }`}
          >
            👎 {review.notHelpfulCount}
          </button>
        </div>

        {review.isOwnReview && (
          confirmingDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted">Delete this review?</span>
              <button
                onClick={() => onDelete(review.id)}
                disabled={deleting}
                className="text-xs font-medium text-red-600 transition hover:text-red-700 disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Yes, delete"}
              </button>
              <button
                onClick={() => setConfirmingDelete(false)}
                className="text-xs text-muted transition hover:text-charcoal"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmingDelete(true)}
              className="text-xs text-subtle transition hover:text-red-600"
            >
              Delete
            </button>
          )
        )}
      </div>
    </div>
  );
}

export function ReviewSection({ productId }: ReviewSectionProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Submit form state
  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  function loadReviews() {
    setLoading(true);
    fetch(`/api/reviews?productId=${productId}&page=${page}`)
      .then((r) => r.json())
      .then((data) => {
        setReviews(data.reviews ?? []);
        setTotalPages(data.totalPages ?? 1);
        setTotal(data.total ?? 0);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadReviews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, page]);

  async function handleVote(reviewId: string, helpful: boolean) {
    const res = await fetch("/api/reviews/vote", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": getCsrf(),
      },
      body: JSON.stringify({ reviewId, helpful }),
    });
    if (!res.ok) return;

    const data = await res.json();
    setReviews((prev) =>
      prev.map((r) =>
        r.id === reviewId
          ? {
              ...r,
              helpfulCount: data.helpfulCount,
              notHelpfulCount: data.notHelpfulCount,
              userVote: data.userVote,
            }
          : r
      )
    );
  }

  async function handleDelete(reviewId: string) {
    setDeletingId(reviewId);
    try {
      const res = await fetch(`/api/reviews?id=${reviewId}`, {
        method: "DELETE",
        headers: { "x-csrf-token": getCsrf() },
      });
      if (res.ok) {
        setReviews((prev) => prev.filter((r) => r.id !== reviewId));
        setTotal((t) => Math.max(0, t - 1));
      }
    } finally {
      setDeletingId(null);
    }
  }

  // Submit review
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating === 0) { setSubmitError("Please select a star rating."); return; }
    if (comment.trim().length < 10) { setSubmitError("Review must be at least 10 characters."); return; }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": getCsrf(),
        },
        body: JSON.stringify({ productId, rating, title, comment }),
      });
      const data = await res.json();

      if (!res.ok) {
        setSubmitError(data.error?.message ?? "Could not submit review.");
        return;
      }

      setSubmitSuccess(true);
      setShowForm(false);
      setRating(0);
      setTitle("");
      setComment("");
    } catch {
      setSubmitError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mt-12 border-t border-ivoryBorder pt-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-display text-lg text-charcoal">
            Customer Reviews
          </h2>
          <p className="text-xs text-subtle mt-0.5">
            {total} review{total !== 1 ? "s" : ""}
          </p>
        </div>
        {!showForm && !submitSuccess && (
          <button
            onClick={() => setShowForm(true)}
            className="rounded-sm border border-gold/50 px-4 py-2 text-sm text-gold transition hover:bg-gold hover:text-white"
          >
            Write a Review
          </button>
        )}
      </div>

      {/* Success message */}
      {submitSuccess && (
        <div className="mb-6 rounded-sm border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          ✓ Your review has been submitted and is awaiting moderation. Thank you!
        </div>
      )}

      {/* Submit form */}
      {showForm && (
        <div className="mb-8 rounded-sm border border-gold/30 bg-white p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-base text-charcoal">Write Your Review</h3>
            <button
              onClick={() => setShowForm(false)}
              className="text-xs text-subtle hover:text-muted"
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Star rating */}
            <div>
              <label className="mb-2 block text-xs uppercase tracking-wider text-muted">
                Your Rating *
              </label>
              <StarPicker value={rating} onChange={setRating} />
            </div>

            {/* Title */}
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wider text-muted">
                Review Title (optional)
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Sum it up in a few words"
                maxLength={150}
                className="w-full rounded-sm border border-ivoryBorder bg-ivory px-3 py-2 text-sm text-charcoal outline-none transition focus:border-gold"
              />
            </div>

            {/* Comment */}
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wider text-muted">
                Your Review *
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="What did you like or dislike? How was the quality?"
                rows={4}
                maxLength={2000}
                className="w-full rounded-sm border border-ivoryBorder bg-ivory px-3 py-2 text-sm text-charcoal outline-none transition focus:border-gold resize-none"
              />
              <p className="mt-1 text-xs text-subtle text-right">
                {comment.length}/2000
              </p>
            </div>

            {submitError && (
              <p className="text-sm text-red-600">{submitError}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-sm bg-gold py-2.5 text-sm font-semibold text-white transition hover:bg-goldDark disabled:opacity-50"
            >
              {submitting ? "Submitting…" : "Submit Review"}
            </button>

            <p className="text-xs text-subtle text-center">
              Only verified purchasers can submit reviews. Reviews are published after moderation.
            </p>
          </form>
        </div>
      )}

      {/* Review list */}
      {loading ? (
        <p className="text-sm text-muted">Loading reviews...</p>
      ) : reviews.length === 0 ? (
        <div className="rounded-sm border border-ivoryBorder bg-white p-8 text-center">
          <p className="text-sm text-muted">No reviews yet. Be the first to review this product.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {reviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              onVote={handleVote}
              onDelete={handleDelete}
              deleting={deletingId === review.id}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-sm border border-ivoryBorder px-3 py-1.5 text-xs text-muted disabled:opacity-40 hover:text-charcoal"
          >
            ← Prev
          </button>
          <span className="text-xs text-muted">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="rounded-sm border border-ivoryBorder px-3 py-1.5 text-xs text-muted disabled:opacity-40 hover:text-charcoal"
          >
            Next →
          </button>
        </div>
      )}
    </section>
  );
}
