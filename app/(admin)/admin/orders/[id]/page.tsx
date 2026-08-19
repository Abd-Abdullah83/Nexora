import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/rbac";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { OrderPaymentActions } from "@/components/admin/OrderPaymentActions";

interface PageProps {
  params: { id: string };
}

export default async function AdminOrderDetailPage({ params }: PageProps) {
  const session = await requireAdmin();
  if (!session) notFound();

  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      items: true,
      user: { select: { fullName: true, email: true } },
    },
  });
  if (!order) notFound();

  const address = order.shippingAddress as any;
  const paymentMethodMatch = order.notes?.match(/payment:(\w+)/);
  const paymentMethod = paymentMethodMatch?.[1] ?? "unknown";

  return (
    <AdminLayout>
      <nav className="text-xs text-slate">
        <Link href="/admin/orders" className="hover:text-brass transition">
          Orders
        </Link>
        <span className="mx-2">/</span>
        <span className="text-cream">{order.orderNumber}</span>
      </nav>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-cream">{order.orderNumber}</h1>
          <p className="text-sm text-slate">
            {order.user.fullName} &middot; {order.user.email}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <StatusBadge label={order.status} tone="status" />
          <StatusBadge label={order.paymentStatus} tone="payment" />
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-4">
          {/* Items */}
          <div className="rounded-sm border border-white/[0.08] bg-surface p-6">
            <h2 className="mb-4 font-display text-base text-cream">Items</h2>
            <div className="flex flex-col divide-y divide-white/[0.06]">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm text-cream">{item.productName}</p>
                    <p className="text-xs text-slate">
                      SKU {item.productSku} &middot; PKR {Number(item.unitPrice).toFixed(2)} ×{" "}
                      {item.quantity}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-brass">
                    PKR {Number(item.totalPrice).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-4 border-t border-white/[0.08] pt-4 flex flex-col gap-1.5 text-sm">
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
              <div className="mt-1 border-t border-white/[0.08] pt-2 flex justify-between font-bold text-cream">
                <span>Total</span>
                <span>PKR {Number(order.total).toFixed(2)}</span>
              </div>
              {order.paymentStatus === "refunded" && order.refundAmount && (
                <div className="flex justify-between text-red-400">
                  <span>Refunded</span>
                  <span>-PKR {Number(order.refundAmount).toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Shipping address */}
          <div className="rounded-sm border border-white/[0.08] bg-surface p-6">
            <h2 className="mb-3 font-display text-base text-cream">Delivering To</h2>
            <div className="text-sm text-slate space-y-0.5">
              <p className="text-cream font-medium">{address.fullName}</p>
              <p>{address.phone}</p>
              <p>{address.addressLine1}</p>
              {address.addressLine2 && <p>{address.addressLine2}</p>}
              <p>{address.city}, {address.state} {address.postalCode}</p>
              <p>{address.country}</p>
            </div>
          </div>
        </div>

        {/* Sidebar: payment actions */}
        <div className="flex flex-col gap-4">
          <div className="rounded-sm border border-white/[0.08] bg-surface p-5">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate/60">
              Payment
            </h3>
            <p className="text-sm text-cream capitalize">{paymentMethod.replace("_", " ")}</p>
            {order.paidAt && (
              <p className="mt-1 text-xs text-slate">
                Paid {new Date(order.paidAt).toLocaleString()}
              </p>
            )}
            {order.paymentIntentId && (
              <p className="mt-1 text-xs text-slate/50 font-mono break-all">
                Ref: {order.paymentIntentId}
              </p>
            )}

            <OrderPaymentActions
              orderId={order.id}
              paymentStatus={order.paymentStatus}
            />
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

function StatusBadge({ label, tone }: { label: string; tone: "status" | "payment" }) {
  const colorMap: Record<string, string> = {
    pending: "bg-amber-500/15 text-amber-400",
    confirmed: "bg-blue-500/15 text-blue-400",
    shipped: "bg-blue-500/15 text-blue-400",
    delivered: "bg-emerald-500/15 text-emerald-400",
    cancelled: "bg-slate/15 text-slate",
    refunded: "bg-red-500/15 text-red-400",
    unpaid: "bg-amber-500/15 text-amber-400",
    paid: "bg-emerald-500/15 text-emerald-400",
    failed: "bg-red-500/15 text-red-400",
  };
  return (
    <span className={`rounded-sm px-2.5 py-1 text-xs font-medium capitalize ${colorMap[label] ?? "bg-white/10 text-slate"}`}>
      {label}
    </span>
  );
}
