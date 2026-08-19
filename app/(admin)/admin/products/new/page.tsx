import { AdminLayout } from "@/components/admin/AdminLayout";
import { ProductForm } from "@/components/admin/ProductForm";

export default function NewProductPage() {
  return (
    <AdminLayout>
      <h1 className="font-display text-2xl text-cream">New Product</h1>
      <p className="mt-1 text-sm text-slate">
        Save the product first, then upload images on the edit page.
      </p>
      <div className="mt-6">
        <ProductForm />
      </div>
    </AdminLayout>
  );
}
