// components/storefront/MessageSellerButton.tsx
//
// BUG 8 FIX: When no orderId is provided (product page context), the

// button was redirecting to /account/orders instead of opening the
// message interface.
//
// ROOT CAUSE: The messaging API (POST /api/sellers/messages) requires an
// orderId — the MessageThread is keyed on [buyerId, sellerId, orderId]
// in the schema. Without an orderId the thread can't be created.
//
// FIX APPROACH: When no orderId is provided, fetch the buyer's most
// recent PAID order that contains a product from this seller, then use
// that orderId to open the thread. This is the correct UX — the buyer
// is messaging about a product they bought (or are looking at). If they
// have no qualifying order, show a "You must have purchased from this
// seller to send a message" message — this is the intended gate and
// avoids spam from non-buyers.
//
// The /account/orders redirect is completely removed. The compose UI
// opens directly on click, exactly the same as when orderId is known.

"use client";

import { useState } from "react";

// BUG 9 FIX: send() never included the x-csrf-token header. Every other
// mutating fetch call in this project does — middleware.ts enforces
// double-submit-cookie CSRF on all non-exempt /api/* POST routes, and
// this route was never exempted. The request was being rejected by
// middleware BEFORE it ever reached the actual message-creation logic.
//
// This also explains why the error shown was the generic fallback text
// ("Could not send message.") rather than something more specific:
// middleware's CSRF rejection returns { error: "CSRF_INVALID" } — a
// plain STRING, not the { error: { message, ... } } object shape every
// other error response in this codebase uses. `json.error?.message` on a
// string is always undefined, so the button always fell back to its
// generic text — regardless of what the real problem was. Once the
// token is actually sent, requests reach the real handler and any real
// validation error will show its own specific message correctly.
function getCsrf(): string {
  return (
    document.cookie
      .split("; ")
      .find((c) => c.startsWith("csrf_token="))
      ?.split("=")[1] ?? ""
  );
}

interface MessageSellerButtonProps {
  sellerId: string;
  orderId?: string | null;
  className?: string;
}

async function fetchOrderIdForSeller(sellerId: string): Promise<string | null> {
  try {
    const res = await fetch(
      `/api/sellers/messages/resolve-order?sellerId=${encodeURIComponent(sellerId)}`
    );
    if (!res.ok) return null;
    const json = await res.json();
    return json.orderId ?? null;
  } catch {
    return null;
  }
}

export function MessageSellerButton({
  sellerId,
  orderId: initialOrderId,
  className,
}: MessageSellerButtonProps) {
  const [orderId, setOrderId] = useState<string | null>(initialOrderId ?? null);
  const [open, setOpen] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [noOrder, setNoOrder] = useState(false);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleOpen() {
    // orderId already known (e.g. from store page or order confirmation)
    if (orderId) {
      setOpen(true);
      return;
    }

    // Resolve orderId from the buyer's purchase history with this seller
    setResolving(true);
    const resolved = await fetchOrderIdForSeller(sellerId);
    setResolving(false);

    if (!resolved) {
      // Buyer has no paid order from this seller — can't message
      setNoOrder(true);
      return;
    }

    setOrderId(resolved);
    setOpen(true);
  }

  async function send() {
    if (!body.trim() || !orderId) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/sellers/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrf() },
        body: JSON.stringify({ sellerId, orderId, body: body.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error?.message ?? "Could not send message.");
        return;
      }
      setSent(true);
      setBody("");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSending(false);
    }
  }

  const btnClass =
    className ??
    "rounded-sm border border-gold px-4 py-2 text-sm font-medium text-gold transition hover:bg-gold/10";

  if (sent) {
    return (
      <div className="rounded-sm border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
        ✓ Message sent — the seller will reply shortly.
      </div>
    );
  }

  if (noOrder) {
    return (
      <div className="rounded-sm border border-ivoryBorder bg-ivory px-4 py-3 text-sm text-muted">
        You can message a seller after placing an order with them.
      </div>
    );
  }

  if (!open) {
    return (
      <button onClick={handleOpen} disabled={resolving} className={btnClass}>
        {resolving ? "Loading…" : "✉ Message Seller"}
      </button>
    );
  }

  return (
    <div className="rounded-sm border border-ivoryBorder bg-white p-4">
      <p className="mb-2 text-xs font-medium text-charcoal">Send a message to the seller</p>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        placeholder="Ask about your order, product details, or anything else…"
        className="w-full resize-none rounded-sm border border-ivoryBorder bg-ivory px-3 py-2 text-sm text-charcoal outline-none focus:border-gold"
      />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      <div className="mt-2 flex gap-2">
        <button
          onClick={send}
          disabled={sending || !body.trim()}
          className="rounded-sm bg-gold px-4 py-2 text-sm font-medium text-white transition hover:bg-goldDark disabled:opacity-50"
        >
          {sending ? "Sending…" : "Send"}
        </button>
        <button
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="rounded-sm border border-ivoryBorder px-4 py-2 text-sm text-muted transition hover:text-charcoal"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
