"use client";

import { useState } from "react";

interface Props {
  orderItemId: string;
  productName: string;
}

export function DisputeButton({ orderItemId, productName }: Props) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"return" | "refund" | "chargeback">("return");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function getCsrf() {
    return document.cookie.split("; ").find((c) => c.startsWith("csrf_token="))?.split("=")[1] ?? "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/buyers/orders/${orderItemId}/dispute`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrf() },
        body: JSON.stringify({ type, buyerReason: reason }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? "Could not open dispute. Please try again.");
        return;
      }
      setDone(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <p className="mt-1 text-xs text-emerald-400">
        ✓ Dispute opened — the seller has been notified.
      </p>
    );
  }

  return (
    <div>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="rounded-sm border border-red-500/30 px-3 py-1 text-xs font-medium text-red-400 transition hover:bg-red-500/10"
        >
          Request Return / Refund
        </button>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="mt-2 rounded-sm border border-white/[0.08] bg-ink p-4"
        >
          <p className="mb-3 text-xs font-medium text-cream">
            Open dispute for: {productName}
          </p>

          <div className="mb-3">
            <label className="mb-1 block text-xs text-slate">Request type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as typeof type)}
              className="w-full rounded-sm border border-white/10 bg-surface px-3 py-1.5 text-xs text-cream focus:border-brass/50 focus:outline-none"
            >
              <option value="return">Return — I want to send it back</option>
              <option value="refund">Refund — I want my money back</option>
              <option value="chargeback">Chargeback — item not received / fraud</option>
            </select>
          </div>

          <div className="mb-3">
            <label className="mb-1 block text-xs text-slate">
              Describe the issue (min 20 characters)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Please describe what went wrong..."
              className="w-full resize-y rounded-sm border border-white/10 bg-surface px-3 py-1.5 text-xs text-cream placeholder:text-slate/50 focus:border-brass/50 focus:outline-none"
            />
          </div>

          {error && <p className="mb-2 text-xs text-red-400">{error}</p>}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting || reason.trim().length < 20}
              className="rounded-sm bg-red-600/80 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-red-600 disabled:opacity-50"
            >
              {submitting ? "Submitting…" : "Submit Dispute"}
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); setError(null); }}
              className="rounded-sm border border-white/10 px-3 py-1.5 text-xs text-slate transition hover:text-cream"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
