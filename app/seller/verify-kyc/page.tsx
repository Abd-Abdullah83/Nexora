import { getActiveCategories } from "@/lib/repositories/category.repository";
import { StorefrontHeader } from "@/components/storefront/StorefrontHeader";
import { Footer } from "@/components/storefront/Footer";
import SellerVerifyKycContent from "./SellerVerifyKycContent";

// Same pattern as the other /seller/* pages (see
// README_STYLING_FIX.md from the earlier styling-fix package): this page
// never had the site's header/footer wrapper, which is why it would have
// sat on the raw gold `body` background like the others did before that
// fix. Applying the identical fix here for consistency.
export default async function SellerVerifyKycPage() {
  const categories = await getActiveCategories();
  const rootCategories = categories.filter((c: any) => (c.level ?? 0) === 0);

  return (
    <div className="min-h-screen bg-ivory">
      <StorefrontHeader />
      <SellerVerifyKycContent />
      <Footer categories={rootCategories} />
    </div>
  );
}
