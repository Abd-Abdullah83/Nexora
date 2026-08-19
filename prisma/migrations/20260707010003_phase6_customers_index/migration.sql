-- Phase 6 gap fill: Seller Customers view
--
-- No new tables needed — this view is a read-only aggregation over
-- existing orders/order_items/users data, scoped by OrderItem.sellerId
-- (already added in the original Phase 6 migration). The only addition
-- here is a composite index to keep that aggregation query fast as order
-- volume grows, since it groups by (sellerId, then joins back to the
-- buyer via the parent order).

CREATE INDEX IF NOT EXISTS "order_items_sellerId_orderId_idx"
  ON "order_items"("sellerId", "orderId");
