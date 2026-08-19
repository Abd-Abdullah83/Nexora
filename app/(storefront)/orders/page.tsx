import { redirect } from "next/navigation";

// This route exists only so /orders keeps working as a shorthand —
// the real implementation lives at /account/orders. Keeping one source
// of truth avoids duplicating the order-list logic in two places.
export default function OrdersRedirectPage() {
  redirect("/account/orders");
}
