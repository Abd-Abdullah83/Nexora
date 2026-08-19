import { getProductById } from "@/lib/repositories/product.repository";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { ProductForm } from "@/components/admin/ProductForm";
import { notFound } from "next/navigation";

interface PageProps {
  params: { id: string };
}

export default async function EditProductPage({ params }: PageProps) {
  const product = await getProductById(params.id);
  if (!product) notFound();

  // Convert saleEndsAt (Date) to the format datetime-local input expects
  // Format: "YYYY-MM-DDTHH:mm" — slice removes seconds and timezone
  const saleEndsAtForInput = (product as any).saleEndsAt
    ? new Date((product as any).saleEndsAt).toISOString().slice(0, 16)
    : "";

  return (
    <AdminLayout>
      <h1 className="font-display text-2xl text-cream">Edit Product</h1>
      <div className="mt-6">
        <ProductForm
          productId={product.id}
          initialData={{
            name: product.name,
            description: product.description,
            shortDescription: product.shortDescription || "",

            // Pricing
            price: String(Number(product.price)),
            comparePrice: product.comparePrice
              ? String(Number(product.comparePrice))
              : "",
            salePrice: (product as any).salePrice
              ? String(Number((product as any).salePrice))
              : "",
            saleEndsAt: saleEndsAtForInput,

            // Currency & video
            currency: (product as any).currency || "PKR",
            videoUrl: (product as any).videoUrl || "",

            // Core fields
            categoryId: product.categoryId,
            sku: product.sku,
            stockQty: String(product.stockQty),
            status: product.status,
            isFeatured: product.isFeatured,
            isBestSeller: product.isBestSeller,
            isNewArrival: product.isNewArrival,
            tags: product.tags.join(", "),
          }}
          existingImages={product.images.map((img) => ({
            id: img.id,
            url: img.url,
            isPrimary: img.isPrimary,
          }))}
        />
      </div>
    </AdminLayout>
  );
}
