"use client";

// components/seller/CategoryRequestPanel.tsx
//
// Inline panel shown under the Category dropdown in ListingForm. Lets a
// seller who can't find the right category submit a request to admin
// instead of being stuck. Also shows the status of their own past/pending
// requests so they know whether to wait or resubmit.

import { useState, useEffect, useCallback } from "react";
import { Field, fieldClass, StatusBadge, SecondaryButton } from "@/components/seller/ui";

interface CategoryOption {
  id: string;
  name: string;
  level: number;
}

interface CategoryRequestRow {
  id: string;
  name: string;
  description: string | null;
  status: "pending" | "approved" | "rejected";
  resolutionNote: string | null;
  createdAt: string;
  parent: { name: string } | null;
  resolvedCategory: { id: string; name: string; slug: string } | null;
}

function getCsrf() {
  return document.cookie.split("; ").find((c) => c.startsWith("csrf_token="))?.split("=")[1] ?? "";
}

const STATUS_TONE: Record<string, "warning" | "success" | "error"> = {
  pending: "warning",
  approved: "success",
  rejected: "error",
};

export function CategoryRequestPanel({ categories }: { categories: CategoryOption[] }) {
  const [expanded, setExpanded] = useState(false);
  const [requests, setRequests] = useState<CategoryRequestRow[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const loadRequests = useCallback(async () => {
    setLoadingRequests(true);
    try {
      const res = await fetch("/api/sellers/category-requests");
      const data = await res.json();
      setRequests(data.requests ?? []);
    } finally {
      setLoadingRequests(false);
    }
  }, []);

  useEffect(() => {
    if (expanded) loadRequests();
  }, [expanded, loadRequests]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch("/api/sellers/category-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrf() },
        body: JSON.stringify({
          name,
          parentId: parentId || null,
          description: description || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.details?.name?.[0] ?? data.error?.message ?? "Could not submit request.");
        return;
      }
      setName("");
      setParentId("");
      setDescription("");
      setSuccess(true);
      loadRequests();
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError("Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="text-sm text-gold underline-offset-2 hover:underline"
      >
        {expanded ? "Hide category request panel" : "Can't find your category? Request a new one →"}
      </button>

      {expanded && (
        <div className="mt-4 rounded-md border border-ivoryBorder bg-ivory/40 p-5">
          {/* Submit form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Field label="Requested category name *">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Vintage Watches"
                className={fieldClass()}
                required
              />
            </Field>

            <Field label="Suggested parent category" hint="Leave blank if this should be a top-level category.">
              <select
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                className={fieldClass()}
              >
                <option value="">— No parent (top-level) —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {"  ".repeat(c.level)}
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Why is this category needed?">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Briefly explain what kind of products this covers…"
                className={`${fieldClass()} resize-none`}
              />
            </Field>

            {error && <p className="text-xs text-red-600">{error}</p>}
            {success && <p className="text-xs text-emerald-600">✓ Request submitted — admin will review it soon.</p>}

            <SecondaryButton type="submit" disabled={submitting || !name.trim()} className="w-fit">
              {submitting ? "Submitting…" : "Submit request"}
            </SecondaryButton>
          </form>

          {/* Own requests list */}
          <div className="mt-6 border-t border-ivoryBorder pt-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
              Your requests {pendingCount > 0 && `(${pendingCount} pending)`}
            </p>
            {loadingRequests ? (
              <p className="text-xs text-muted">Loading…</p>
            ) : requests.length === 0 ? (
              <p className="text-xs text-muted">No category requests yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {requests.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between rounded-sm border border-ivoryBorder bg-white px-3 py-2"
                  >
                    <div>
                      <p className="text-sm text-charcoal">{r.name}</p>
                      {r.parent && <p className="text-xs text-muted">Under: {r.parent.name}</p>}
                      {r.status === "rejected" && r.resolutionNote && (
                        <p className="mt-0.5 text-xs text-red-600">{r.resolutionNote}</p>
                      )}
                      {r.status === "approved" && r.resolvedCategory && (
                        <p className="mt-0.5 text-xs text-emerald-600">
                          Now live as "{r.resolvedCategory.name}" — refresh the category dropdown to use it.
                        </p>
                      )}
                    </div>
                    <StatusBadge tone={STATUS_TONE[r.status]}>{r.status}</StatusBadge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
