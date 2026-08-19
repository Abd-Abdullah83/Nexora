"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function getCsrfToken(): string {
  return (
    document.cookie
      .split("; ")
      .find((c) => c.startsWith("csrf_token="))
      ?.split("=")[1] ?? ""
  );
}

export function OrderPaymentActions({
  orderId,
  paymentStatus,
}: {
  orderId: string;
  paymentStatus: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleConfirmPayment() {
    if (!confirm("Mark this order as paid? This will decrement stock for all items.")) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/confirm-payment`, {
        method: "POST",
        headers: { "x-csrf-token": getCsrfToken() },
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error?.message ?? "Could not confirm payment."); return; }
      router.refresh();
    } catch { setError("Network error."); }
    finally { setLoading(false); }
  }

  async function handleRefund() {
    const reason = prompt("Reason for refund (optional):") ?? undefined;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrfToken() },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error?.message ?? "Could not process refund."); return; }
      setMessage(data.message);
      router.refresh();
    } catch { setError("Network error."); }
    finally { setLoading(false); }
  }

  async function handleProcessReturn() {
    const reason = prompt("Return reason (optional):") ?? undefined;
    const restock = confirm("Restock inventory for returned items?\n\nClick OK to restock, Cancel to refund without restocking.");

    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/process-return`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrfToken() },
        body: JSON.stringify({ restockItems: restock, reason }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error?.message ?? "Could not process return."); return; }
      setMessage(data.message);
      router.refresh();
    } catch { setError("Network error."); }
    finally { setLoading(false); }
  }

  return (
    <div className="mt-4 flex flex-col gap-2">
      {paymentStatus === "unpaid" && (
        <button
          onClick={handleConfirmPayment}
          disabled={loading}
          className="w-full rounded-sm bg-emerald-500/90 py-2.5 text-sm font-semibold text-ink transition hover:bg-emerald-400 disabled:opacity-50"
        >
          {loading ? "Confirming…" : "✓ Mark as Paid"}
        </button>
      )}

      {paymentStatus === "paid" && (
        <>
          <button
            onClick={handleRefund}
            disabled={loading}
            className="w-full rounded-sm border border-red-400/40 py-2.5 text-sm font-medium text-red-400 transition hover:bg-red-400/10 disabled:opacity-50"
          >
            {loading ? "Processing…" : "Issue Refund"}
          </button>
          <button
            onClick={handleProcessReturn}
            disabled={loading}
            className="w-full rounded-sm border border-amber-400/40 py-2.5 text-sm font-medium text-amber-400 transition hover:bg-amber-400/10 disabled:opacity-50"
          >
            {loading ? "Processing…" : "Process Return + Restock"}
          </button>
        </>
      )}

      {paymentStatus === "refunded" && (
        <p className="text-center text-xs text-slate/60">This order has been refunded.</p>
      )}

      {message && (
        <p className="rounded-sm border border-brass/20 bg-brass/5 px-3 py-2 text-xs text-brass/80">{message}</p>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
