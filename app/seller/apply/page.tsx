import { getActiveCategories } from "@/lib/repositories/category.repository";
import { StorefrontHeader } from "@/components/storefront/StorefrontHeader";
import { Footer } from "@/components/storefront/Footer";
import SellerApplyForm from "./SellerApplyForm";

export const dynamic = "force-dynamic";

// This file is a Server Component (no "use client") so it can fetch
// categories the same way app/page.tsx does, then wraps the actual
// interactive form (moved to SellerApplyForm.tsx, a Client Component)
// with the same <StorefrontHeader />/<Footer /> + bg-ivory shell every
// other page on the site uses — that's what was missing before, which is
// why this page sat directly on the raw gold `body` background.
export default async function SellerApplyPage() {
  const categories = await getActiveCategories();
  const rootCategories = categories.filter((c: any) => (c.level ?? 0) === 0);

  return (
    <div className="min-h-screen bg-ivory">
      <StorefrontHeader />
      <SellerApplyForm />
      <Footer categories={rootCategories} />
    </div>
  );
}
