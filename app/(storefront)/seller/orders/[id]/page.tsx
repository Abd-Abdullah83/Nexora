// app/(storefront)/seller/orders/[id]/page.tsx
//
// Phase 6 — manage a single order line: confirm, ship (with tracking),
// mark delivered, or cancel (with reason + auto stock restoration).

"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { SellerLayout } from "@/components/seller/SellerLayout";

interface OrderLine {
  id: string;
  orderId: string;
  orderNumber: string;
  productId: string;
  productName: string;
  productSku: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  fulfillmentStatus: "pending" | "confirmed" | "shipped" | "delivered" | "cancelled";
  sellerTrackingNumber: string | null;
  sellerTrackingUrl: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  buyerName: string;
  shippingAddress: {
    fullName: string;
    phone: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  orderPlacedAt: string;
  orderPaymentStatus: string;
}

function getCsrf(): string {
  return document.cookie.split("; ").find((c) => c.startsWith("csrf_token="))?.split("=")[1] ?? "";
}

const STEPS = ["pending", "confirmed", "shipped", "delivered"];

export default function SellerOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [line, setLine] = useState<OrderLine | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [showCancelForm, setShowCancelForm] = useState(false);

  useEffect(() => {
    fetch(`/api/sellers/orders/${params.id}`)
      .then((r) => r.json())
      .then((data) => setLine(data.orderItem ?? null))
      .finally(() => setLoading(false));
  }, [params.id]);

  async function updateStatus(status: string, extra: Record<string, string> = {}) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/sellers/orders/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrf() },
        body: JSON.stringify({ status, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? "Could not update order.");
        return;
      }
      setLine(data.orderItem);
      setShowCancelForm(false);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <SellerLayout>
        <p className="text-sm text-muted">Loading…</p>
      </SellerLayout>
    );
  }

  if (!line) {
    return (
      <SellerLayout>
        <div className="rounded-sm border border-ivoryBorder bg-white p-10 text-center">
          <p className="text-sm text-muted">Order line not found.</p>
          <button onClick={() => router.push("/seller/orders")} className="mt-3 text-sm text-gold hover:underline">
            ← Back to orders
          </button>
        </div>
      </SellerLayout>
    );
  }

  const stepIndex = STEPS.indexOf(line.fulfillmentStatus);
  const isCancelled = line.fulfillmentStatus === "cancelled";
  const isTerminal = line.fulfillmentStatus === "delivered" || isCancelled;

  return (
    <SellerLayout>
      <button onClick={() => router.push("/seller/orders")} className="mb-4 text-sm text-muted hover:text-charcoal">
        ← Back to orders
      </button>

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl text-charcoal">Order {line.orderNumber}</h1>
          <p className="text-sm text-muted">Placed {new Date(line.orderPlacedAt).toLocaleDateString()}</p>
        </div>
      </div>

      {/* Progress steps */}
      {!isCancelled && (
        <div className="mb-8 flex items-center">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${
                i <= stepIndex ? "bg-gold text-white" : "border border-ivoryBorder text-muted"
              }`}>
                {i < stepIndex ? "✓" : i + 1}
              </div>
              <span className={`ml-2 text-xs capitalize ${i === stepIndex ? "text-charcoal font-medium" : "text-muted"}`}>
                {s}
              </span>
              {i < STEPS.length - 1 && (
                <div className={`mx-3 h-px w-10 ${i < stepIndex ? "bg-gold" : "bg-ivoryBorder"}`} />
              )}
            </div>
          ))}
        </div>
      )}

      {isCancelled && (
        <div className="mb-6 rounded-sm border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-700">Order Cancelled</p>
          <p className="mt-1 text-sm text-red-600">{line.cancellationReason}</p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">

        {/* Left: line item + actions */}
        <div className="flex flex-col gap-4">
          <div className="rounded-sm border border-ivoryBorder bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-charcoal">Item</h2>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-charcoal">{line.productName}</p>
                <p className="text-xs text-muted">{line.productSku} · Qty {line.quantity}</p>
              </div>
              <span className="text-sm font-semibold text-gold">PKR {line.totalPrice.toFixed(2)}</span>
            </div>
          </div>

          {error && (
            <div className="rounded-sm border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Action buttons by current status */}
          {!isTerminal && (
            <div className="rounded-sm border border-ivoryBorder bg-white p-5">
              <h2 className="mb-3 text-sm font-semibold text-charcoal">Update Status</h2>

              {line.fulfillmentStatus === "pending" && (
                <button
                  onClick={() => updateStatus("confirmed")}
                  disabled={saving}
                  className="w-full rounded-sm bg-charcoal py-2.5 text-sm font-semibold text-white transition hover:bg-gold disabled:opacity-50"
                >
                  Confirm Order
                </button>
              )}

              {line.fulfillmentStatus === "confirmed" && (
                <div className="flex flex-col gap-3">
                  <input
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    placeholder="Tracking number *"
                    className="rounded-sm border border-ivoryBorder bg-ivory px-3 py-2 text-sm outline-none focus:border-gold"
                  />
                  <input
                    value={trackingUrl}
                    onChange={(e) => setTrackingUrl(e.target.value)}
                    placeholder="Tracking URL (optional)"
                    className="rounded-sm border border-ivoryBorder bg-ivory px-3 py-2 text-sm outline-none focus:border-gold"
                  />
                  <button
                    onClick={() => updateStatus("shipped", { trackingNumber, trackingUrl })}
                    disabled={saving || !trackingNumber.trim()}
                    className="rounded-sm bg-charcoal py-2.5 text-sm font-semibold text-white transition hover:bg-gold disabled:opacity-50"
                  >
                    Mark as Shipped
                  </button>
                </div>
              )}

              {line.fulfillmentStatus === "shipped" && (
                <button
                  onClick={() => updateStatus("delivered")}
                  disabled={saving}
                  className="w-full rounded-sm bg-charcoal py-2.5 text-sm font-semibold text-white transition hover:bg-gold disabled:opacity-50"
                >
                  Mark as Delivered
                </button>
              )}

              {/* Cancel — available from pending or confirmed only */}
              {(line.fulfillmentStatus === "pending" || line.fulfillmentStatus === "confirmed") && (
                <div className="mt-3 border-t border-ivoryBorder pt-3">
                  {!showCancelForm ? (
                    <button
                      onClick={() => setShowCancelForm(true)}
                      className="text-sm text-red-500 hover:underline"
                    >
                      Cancel this line
                    </button>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <textarea
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        placeholder="Reason for cancellation *"
                        rows={2}
                        className="rounded-sm border border-ivoryBorder bg-ivory px-3 py-2 text-sm outline-none focus:border-gold resize-none"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => updateStatus("cancelled", { cancellationReason: cancelReason })}
                          disabled={saving || cancelReason.trim().length < 5}
                          className="rounded-sm bg-red-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-red-600 disabled:opacity-50"
                        >
                          Confirm Cancellation
                        </button>
                        <button onClick={() => setShowCancelForm(false)} className="text-xs text-muted hover:text-charcoal">
                          Back
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Tracking info display once shipped */}
          {line.sellerTrackingNumber && (
            <div className="rounded-sm border border-ivoryBorder bg-white p-5">
              <h2 className="mb-2 text-sm font-semibold text-charcoal">Tracking</h2>
              <p className="text-sm text-charcoal">{line.sellerTrackingNumber}</p>
              {line.sellerTrackingUrl && (
                <a href={line.sellerTrackingUrl} target="_blank" rel="noreferrer" className="text-xs text-gold hover:underline">
                  Track shipment →
                </a>
              )}
            </div>
          )}
        </div>

        {/* Right: buyer + shipping info */}
        <div className="flex flex-col gap-4">
          <div className="rounded-sm border border-ivoryBorder bg-white p-5">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Buyer</h2>
            <p className="text-sm text-charcoal">{line.buyerName}</p>
          </div>
          <div className="rounded-sm border border-ivoryBorder bg-white p-5">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Ship To</h2>
            <div className="text-sm text-charcoal space-y-0.5">
              <p>{line.shippingAddress.fullName}</p>
              <p className="text-muted">{line.shippingAddress.phone}</p>
              <p>{line.shippingAddress.addressLine1}</p>
              {line.shippingAddress.addressLine2 && <p>{line.shippingAddress.addressLine2}</p>}
              <p>{line.shippingAddress.city}, {line.shippingAddress.state} {line.shippingAddress.postalCode}</p>
              <p>{line.shippingAddress.country}</p>
            </div>
          </div>
          <div className="rounded-sm border border-ivoryBorder bg-white p-5">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Payment</h2>
            <p className="text-sm capitalize text-charcoal">{line.orderPaymentStatus}</p>
          </div>
        </div>
      </div>
    </SellerLayout>
  );
}
