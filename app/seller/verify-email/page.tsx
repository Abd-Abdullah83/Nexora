import { Suspense } from "react";
import { getActiveCategories } from "@/lib/repositories/category.repository";
import { StorefrontHeader } from "@/components/storefront/StorefrontHeader";
import { Footer } from "@/components/storefront/Footer";
import SellerVerifyEmailContent from "./SellerVerifyEmailContent";

export const dynamic = "force-dynamic";

export default async function SellerVerifyEmailPage() {
  const categories = await getActiveCategories();
  const rootCategories = categories.filter((c: any) => (c.level ?? 0) === 0);

  return (
    <div className="min-h-screen bg-ivory">
      <StorefrontHeader />
      <Suspense fallback={null}>
        <SellerVerifyEmailContent />
      </Suspense>
      <Footer categories={rootCategories} />
    </div>
  );
}

