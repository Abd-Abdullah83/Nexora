import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getOrdersByUser } from "@/lib/repositories/order.repository";
import { StorefrontHeader } from "@/components/storefront/StorefrontHeader";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-400",
  confirmed: "bg-blue-500/15 text-blue-400",
  shipped: "bg-blue-500/15 text-blue-400",
  delivered: "bg-green-500/15 text-green-400",
  cancelled: "bg-slate/15 text-slate",
  refunded: "bg-red-500/15 text-red-400",
};

const PAYMENT_STYLES: Record<string, string> = {
  unpaid: "text-amber-400",
  paid: "text-emerald-400",
  failed: "text-red-400",
  refunded: "text-red-400",
};

export default async function OrdersListPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const orders = await getOrdersByUser(session.userId);

  return (
    <div className="min-h-screen bg-ink">
      <StorefrontHeader />

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <h1 className="font-display text-2xl text-cream">My Orders</h1>

        {orders.length === 0 ? (
          <div className="mt-8 rounded-sm border border-white/[0.08] bg-surface p-10 text-center">
            <p className="text-sm text-slate">You haven&apos;t placed any orders yet.</p>
            <Link
              href="/"
              className="mt-4 inline-block rounded-sm border border-brass/40 px-5 py-2 text-sm text-brass transition hover:bg-brass/10"
            >
              Start Shopping
            </Link>
          </div>
        ) : (
          <div className="mt-6 flex flex-col gap-3">
            {orders.map((order) => {
              const itemCount = order.items.reduce((sum, i) => sum + i.quantity, 0);
              return (
                <Link
                  key={order.id}
                  href={`/orders/${order.id}/confirmation`}
                  className="flex flex-col gap-3 rounded-sm border border-white/[0.08] bg-surface p-5 transition hover:border-brass/30 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-mono text-sm text-brass">{order.orderNumber}</p>
                    <p className="mt-1 text-xs text-slate">
                      {new Date(order.createdAt).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                      {" · "}
                      {itemCount} item{itemCount !== 1 ? "s" : ""}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-sm px-2.5 py-1 text-xs font-medium capitalize ${STATUS_STYLES[order.status] ?? "bg-white/10 text-slate"
                        }`}
                    >
                      {order.status}
                    </span>
                    <span
                      className={`text-xs font-medium capitalize ${PAYMENT_STYLES[order.paymentStatus] ?? "text-slate"
                        }`}
                    >
                      {order.paymentStatus}
                    </span>
                    <span className="text-sm font-semibold text-cream tabular-nums">
                      {order.currency} {Number(order.total).toFixed(2)}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
