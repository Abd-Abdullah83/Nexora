import { getActiveCategories } from "@/lib/repositories/category.repository";
import { StorefrontHeader } from "@/components/storefront/StorefrontHeader";
import { Footer } from "@/components/storefront/Footer";
import SellerVerifyPhoneContent from "./SellerVerifyPhoneContent";

export default async function SellerVerifyPhonePage() {
  const categories = await getActiveCategories();
  const rootCategories = categories.filter((c: any) => (c.level ?? 0) === 0);

  return (
    <div className="min-h-screen bg-ivory">
      <StorefrontHeader />
      <SellerVerifyPhoneContent />
      <Footer categories={rootCategories} />
    </div>
  );
}
