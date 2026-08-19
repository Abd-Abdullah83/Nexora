"use client";
// components/admin/ProductEnforcementModal.tsx
//
// Reason-entry modal for suspend/ban/reinstate on a single product
// listing. Visually mirrors the ActionModal already used on the seller
// detail page (app/(admin)/admin/sellers/[id]/page.tsx) for consistency.

import { useState } from "react";

function getCsrf() {
  return document.cookie.split("; ").find((c) => c.startsWith("csrf_token="))?.split("=")[1] ?? "";
}

type Action = "suspend" | "ban" | "reinstate";

const TITLES: Record<Action, string> = {
  suspend: "Suspend Listing",
  ban: "Request Permanent Ban",
  reinstate: "Reinstate Listing",
};

const ENDPOINTS: Record<Action, string> = {
  suspend: "suspend",
  ban: "ban",
  reinstate: "reinstate",
};

export function ProductEnforcementModal({
  productId,
  action,
  onDone,
  onClose,
}: {
  productId: string;
  action: Action;
  onDone: () => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [confirmBan, setConfirmBan] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (action === "ban" && !confirmBan) {
      setError("Check the confirmation box to proceed.");
      return;
    }
    setWorking(true);
    setError(null);
    const res = await fetch(`/api/admin/products/${productId}/${ENDPOINTS[action]}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-csrf-token": getCsrf() },
      body: JSON.stringify({ reason }),
    });
    const json = await res.json();
    setWorking(false);
    if (!res.ok) {
      setError(json.error?.message ?? "Action failed.");
      return;
    }
    onDone();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-full max-w-md rounded-sm border border-white/10 bg-surface p-6 shadow-xl">
        <h3 className="font-display text-lg text-cream mb-1">{TITLES[action]}</h3>

        {action === "ban" && (
          <p className="text-xs text-amber-300 mb-4">
            This creates a ban request — a different admin must confirm it before the listing is
            actually banned. Nothing happens to the listing until then.
          </p>
        )}
        {action === "suspend" && (
          <p className="text-xs text-slate mb-4">
            Takes the listing offline immediately. Reversible — reinstate it any time. Only one
            admin's approval is needed.
          </p>
        )}

        <form onSubmit={submit} className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-xs text-slate">Reason (required, min 10 chars)</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="This is sent to the seller as the reason, and written to the audit log..."
              className="w-full resize-none rounded-sm border border-white/10 bg-ink px-3 py-2 text-sm text-cream focus:border-brass focus:outline-none"
            />
          </div>

          {action === "ban" && (
            <label className="flex items-center gap-2 text-sm text-cream cursor-pointer">
              <input
                type="checkbox"
                checked={confirmBan}
                onChange={(e) => setConfirmBan(e.target.checked)}
                className="rounded"
              />
              I've reviewed this listing and want to request a ban.
            </label>
          )}

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={working || reason.trim().length < 10 || (action === "ban" && !confirmBan)}
              className={`rounded-sm px-5 py-2 text-sm font-semibold transition disabled:opacity-50 ${
                action === "ban"
                  ? "bg-amber-700 text-white hover:bg-amber-600"
                  : action === "suspend"
                  ? "bg-orange-700 text-white hover:bg-orange-600"
                  : "bg-brass text-ink hover:bg-brassLight"
              }`}
            >
              {working ? "Working…" : TITLES[action]}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-sm border border-white/10 px-5 py-2 text-sm text-slate hover:text-cream transition"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
