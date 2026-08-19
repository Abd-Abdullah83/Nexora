import { notFound } from "next/navigation";
import Link from "next/link";
import { getOrderById } from "@/lib/repositories/order.repository";
import { getSession } from "@/lib/auth/session";
import { StorefrontHeader } from "@/components/storefront/StorefrontHeader";
import { DisputeButton } from "./DisputeButton";

interface PageProps {
  params: { id: string };
}

const FULFILLMENT_LABELS: Record<string, string> = {
  pending: "Preparing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const FULFILLMENT_STYLES: Record<string, string> = {
  pending: "bg-white/10 text-slate",
  shipped: "bg-blue-500/10 text-blue-300",
  delivered: "bg-emerald-500/10 text-emerald-300",
  cancelled: "bg-red-500/10 text-red-300",
};

export default async function OrderConfirmationPage({ params }: PageProps) {
  const session = await getSession();
  if (!session) notFound();

  const order = await getOrderById(params.id);
  if (!order || order.userId !== session.userId) notFound();

  const address = order.shippingAddress as any;
  const isDelivered = order.status === "delivered";

  // Phase 6 gap fill: group items by seller so a multi-seller order shows
  // each seller's own fulfillment status and tracking separately, rather
  // than one flat list with no indication the order came from more than
  // one store. Falls back gracefully to a single group for single-seller
  // orders (the overwhelming majority today) — no visual change for those.
  const itemsBySeller = new Map<string, { sellerName: string; items: typeof order.items }>();
  for (const item of order.items) {
    const key = item.sellerId;
    if (!itemsBySeller.has(key)) {
      itemsBySeller.set(key, {
        sellerName: item.seller?.displayName ?? "Nexora",
        items: [],
      });
    }
    itemsBySeller.get(key)!.items.push(item);
  }
  const sellerGroups = Array.from(itemsBySeller.values());
  const isMultiSeller = sellerGroups.length > 1;

  return (
    <div className="min-h-screen bg-ink">
      <StorefrontHeader />

      <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">

        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-3xl">
            ✓
          </div>
          <h1 className="font-display text-2xl text-cream">
            {isDelivered ? "Order Delivered" : "Order Placed!"}
          </h1>
          <p className="mt-2 text-sm text-slate">
            {isDelivered
              ? "Your order has been delivered. If there's an issue, you can request a return or refund below."
              : "Thank you for your order. We'll get it to you soon."}
          </p>
          <p className="mt-1 font-mono text-xs text-brass">{order.orderNumber}</p>
        </div>

        {/* Order status badge */}
        <div className="mb-6 flex items-center justify-center gap-3">
          <span className="rounded-sm px-3 py-1 text-xs font-medium capitalize bg-white/10 text-slate">
            {order.status}
          </span>
          <span className="text-xs capitalize text-slate">{order.paymentStatus}</span>
        </div>

        {isMultiSeller && (
          <div className="mb-6 rounded-sm border border-brass/20 bg-brass/5 px-4 py-3 text-sm text-brass/80">
            📦 This order ships from {sellerGroups.length} different sellers — each shipment is tracked separately below.
          </div>
        )}

        {/* Order items, grouped by seller */}
        <div className="mb-6 flex flex-col gap-4">
          {sellerGroups.map((group, idx) => {
            // A group's overall status: worst-case across its own items,
            // just for the header badge — individual line items still
            // show their own status too, in case they differ.
            const groupStatus =
              group.items.every((i) => i.fulfillmentStatus === "delivered") ? "delivered" :
              group.items.some((i) => i.fulfillmentStatus === "shipped") ? "shipped" :
              group.items.every((i) => i.fulfillmentStatus === "cancelled") ? "cancelled" :
              "pending";

            // One tracking number to show at the group level only when
            // every item in this seller's shipment shares the same one
            // (the common case — a seller usually ships a whole order
            // together). If they differ, each line shows its own below.
            const trackingNumbers = new Set(group.items.map((i) => i.sellerTrackingNumber).filter(Boolean));
            const sharedTracking = trackingNumbers.size === 1 ? group.items.find((i) => i.sellerTrackingNumber)! : null;

            return (
              <div key={idx} className="rounded-sm border border-white/[0.08] bg-surface p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-display text-base text-cream">
                    {isMultiSeller ? `Sold by ${group.sellerName}` : "Your Items"}
                  </h2>
                  <span className={`rounded-sm px-2 py-0.5 text-xs font-medium ${FULFILLMENT_STYLES[groupStatus] ?? ""}`}>
                    {FULFILLMENT_LABELS[groupStatus] ?? groupStatus}
                  </span>
                </div>

                {sharedTracking?.sellerTrackingNumber && (
                  <div className="mb-4 rounded-sm border border-white/[0.06] bg-ink/40 px-3.5 py-2.5 text-xs">
                    <span className="text-slate">Tracking number: </span>
                    {sharedTracking.sellerTrackingUrl ? (
                      <a
                        href={sharedTracking.sellerTrackingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-brass hover:text-brassLight underline"
                      >
                        {sharedTracking.sellerTrackingNumber}
                      </a>
                    ) : (
                      <span className="font-mono text-cream">{sharedTracking.sellerTrackingNumber}</span>
                    )}
                  </div>
                )}

                <div className="flex flex-col divide-y divide-white/[0.06]">
                  {group.items.map((item) => (
                    <div key={item.id} className="py-3">
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <p className="text-sm text-cream">{item.productName}</p>
                          <p className="text-xs text-slate">
                            PKR {Number(item.unitPrice).toFixed(2)} × {item.quantity}
                          </p>
                          {/* Only shown per-line if it differs from the group's shared tracking above */}
                          {!sharedTracking && item.sellerTrackingNumber && (
                            <p className="mt-1 text-xs text-slate">
                              Tracking:{" "}
                              {item.sellerTrackingUrl ? (
                                <a href={item.sellerTrackingUrl} target="_blank" rel="noopener noreferrer"
                                  className="font-mono text-brass hover:text-brassLight underline">
                                  {item.sellerTrackingNumber}
                                </a>
                              ) : (
                                <span className="font-mono text-cream">{item.sellerTrackingNumber}</span>
                              )}
                            </p>
                          )}
                        </div>
                        <span className="text-sm text-brass">
                          PKR {Number(item.totalPrice).toFixed(2)}
                        </span>
                      </div>

                      {/* Phase 9: Return/Refund button — only visible on delivered orders */}
                      {isDelivered && (
                        <div className="mt-2">
                          <DisputeButton
                            orderItemId={item.id}
                            productName={item.productName}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Totals — whole-order, shown once below all seller groups */}
          <div className="rounded-sm border border-white/[0.08] bg-surface p-6">
            <div className="flex flex-col gap-1.5 text-sm">
              <div className="flex justify-between text-slate">
                <span>Subtotal</span>
                <span>PKR {Number(order.subtotal).toFixed(2)}</span>
              </div>
              {Number(order.discountAmount) > 0 && (
                <div className="flex justify-between text-emerald-400">
                  <span>Discount</span>
                  <span>-PKR {Number(order.discountAmount).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate">
                <span>Shipping</span>
                <span className="text-emerald-400">Free</span>
              </div>
              <div className="mt-1 flex justify-between border-t border-white/[0.08] pt-2 font-bold text-cream">
                <span>Total</span>
                <span>PKR {Number(order.total).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Shipping address */}
        <div className="mb-6 rounded-sm border border-white/[0.08] bg-surface p-6">
          <h2 className="mb-3 font-display text-base text-cream">Delivering To</h2>
          <div className="space-y-0.5 text-sm text-slate">
            <p className="font-medium text-cream">{address.fullName}</p>
            <p>{address.phone}</p>
            <p>{address.addressLine1}</p>
            {address.addressLine2 && <p>{address.addressLine2}</p>}
            <p>{address.city}, {address.state} {address.postalCode}</p>
            <p>{address.country}</p>
          </div>
        </div>

        {/* Payment note */}
        <div className="mb-6 rounded-sm border border-brass/20 bg-brass/5 px-4 py-3 text-sm text-brass/80">
          💳 Payment is collected on delivery (Cash on Delivery).
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/"
            className="flex-1 rounded-sm border border-white/10 py-2.5 text-center text-sm text-slate transition hover:border-brass/30 hover:text-cream"
          >
            Continue Shopping
          </Link>
          <Link
            href="/orders"
            className="flex-1 rounded-sm bg-brass py-2.5 text-center text-sm font-semibold text-ink transition hover:bg-brassLight"
          >
            View My Orders
          </Link>
        </div>
      </main>
    </div>
  );
}
