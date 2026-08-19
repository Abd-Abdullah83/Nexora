"use client";
// components/admin/ProductActionsCell.tsx
//
// Drop-in replacement for the "Actions" column cell in your admin
// products table. Renders one of two completely different action sets:
//
//   - Platform-owned product (system seller): Edit | Duplicate | Archive
//     — exactly what you have today, unchanged.
//   - Seller-owned product: Suspend/Reinstate + Request Ban, or the
//     pending-ban-request panel — admin acts on it, never edits its
//     content directly (that already 403s server-side per BUG 1's fix
//     to app/api/admin/products/[id]/route.ts).
//
// ── Data this component needs on each product row ─────────────────────────
// Your admin products LIST route (GET /api/admin/products) needs to
// return two extra things per product, which it very likely doesn't
// return yet — check its current `select`/`include` and add if missing:
//
//   isSystemSellerProduct: boolean   // product.seller?.isSystemSeller ?? true
//   pendingBanRequest: { id: string; requestedBy: string; requesterName: string } | null
//     // from a LEFT JOIN-equivalent: product.banRequests.find(r => r.status === "pending")
//
// If your list route currently does `select: { seller: { select: { ... } } }`
// without `isSystemSeller`, add it there. If it doesn't include
// `banRequests` at all, add `banRequests: { where: { status: "pending" }, take: 1, include: { requester: { select: { id: true, fullName: true } } } }`.

import { useState } from "react";
import { ProductEnforcementModal } from "./ProductEnforcementModal";

export interface ProductActionsCellProduct {
  id: string;
  status: string; // draft | active | archived | pending_review | rejected | admin_suspended | admin_banned
  isSystemSellerProduct: boolean;
  pendingBanRequest: { id: string; requestedBy: string; requesterName: string } | null;
}

function getCsrf() {
  return document.cookie.split("; ").find((c) => c.startsWith("csrf_token="))?.split("=")[1] ?? "";
}

export function ProductActionsCell({
  product,
  currentAdminId,
  onEdit,
  onDuplicate,
  onArchive,
  onChanged,
}: {
  product: ProductActionsCellProduct;
  currentAdminId: string | undefined;
  onEdit: () => void;
  onDuplicate: () => void;
  onArchive: () => void;
  onChanged: () => void; // call your table's refetch/reload after any action
}) {
  const [modal, setModal] = useState<"suspend" | "ban" | "reinstate" | null>(null);
  const [working, setWorking] = useState<"confirm" | "cancel" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Platform-owned product: unchanged, existing behaviour ────────────
  if (product.isSystemSellerProduct) {
    return (
      <div className="flex gap-3 text-xs">
        <button onClick={onEdit} className="text-brass hover:text-brassLight">Edit</button>
        <button onClick={onDuplicate} className="text-slate hover:text-cream">Duplicate</button>
        <button onClick={onArchive} className="text-red-400 hover:text-red-300">Archive</button>
      </div>
    );
  }

  // ── Terminal: already banned ──────────────────────────────────────────
  if (product.status === "admin_banned") {
    return <span className="text-xs text-red-400">Banned</span>;
  }

  async function act(action: "confirm" | "cancel") {
    if (!product.pendingBanRequest) return;
    setWorking(action);
    setError(null);
    const res = await fetch(`/api/admin/products/${product.id}/ban-request/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-csrf-token": getCsrf() },
      body: JSON.stringify({}),
    });
    const json = await res.json();
    setWorking(null);
    if (!res.ok) {
      setError(json.error?.message ?? `Could not ${action}.`);
      return;
    }
    onChanged();
  }

  // ── Pending ban request: show confirm/cancel or awaiting-status ──────
  if (product.pendingBanRequest) {
    const isOwnRequest = currentAdminId === product.pendingBanRequest.requestedBy;
    return (
      <div className="flex flex-col gap-1 text-xs">
        <span className="text-amber-300">
          Ban pending ({product.pendingBanRequest.requesterName})
        </span>
        {error && <span className="text-red-400">{error}</span>}
        <div className="flex gap-2">
          {isOwnRequest ? (
            <button onClick={() => act("cancel")} disabled={working !== null} className="text-slate hover:text-cream disabled:opacity-50">
              {working === "cancel" ? "…" : "Cancel"}
            </button>
          ) : (
            <>
              <button onClick={() => act("confirm")} disabled={working !== null} className="text-red-400 hover:text-red-300 disabled:opacity-50">
                {working === "confirm" ? "…" : "Confirm Ban"}
              </button>
              <button onClick={() => act("cancel")} disabled={working !== null} className="text-slate hover:text-cream disabled:opacity-50">
                {working === "cancel" ? "…" : "Decline"}
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Suspended: offer reinstate ────────────────────────────────────────
  if (product.status === "admin_suspended") {
    return (
      <>
        {modal === "reinstate" && (
          <ProductEnforcementModal
            productId={product.id}
            action="reinstate"
            onDone={() => { setModal(null); onChanged(); }}
            onClose={() => setModal(null)}
          />
        )}
        <button onClick={() => setModal("reinstate")} className="text-xs text-emerald-400 hover:text-emerald-300">
          Reinstate
        </button>
      </>
    );
  }

  // ── Normal seller-owned listing: Suspend + Request Ban ────────────────
  return (
    <>
      {modal && modal !== "reinstate" && (
        <ProductEnforcementModal
          productId={product.id}
          action={modal}
          onDone={() => { setModal(null); onChanged(); }}
          onClose={() => setModal(null)}
        />
      )}
      <div className="flex gap-3 text-xs">
        <button onClick={() => setModal("suspend")} className="text-orange-400 hover:text-orange-300">
          Suspend
        </button>
        <button onClick={() => setModal("ban")} className="text-red-400 hover:text-red-300">
          Ban
        </button>
      </div>
    </>
  );
}
