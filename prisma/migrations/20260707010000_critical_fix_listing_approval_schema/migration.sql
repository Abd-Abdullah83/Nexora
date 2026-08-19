-- CRITICAL FIX — foreign keys only. The enum values and columns this
-- migration originally also added are already covered by
-- 20260702100001_add_listing_approval_enums and
-- 20260702100002_add_listing_approval_columns, which run earlier in
-- sequence. Keeping only the genuinely new part here.

ALTER TABLE "products"
  ADD CONSTRAINT "products_reviewedBy_fkey"
  FOREIGN KEY ("reviewedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "sellers"
  ADD CONSTRAINT "sellers_trustGrantedBy_fkey"
  FOREIGN KEY ("trustGrantedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;