import { getProductBySlug } from "@/lib/repositories/product.repository";
import { getProductRatingSummary } from "@/lib/repositories/review.repository";
import { AppError, errorResponse } from "@/lib/errors";

export async function GET(
  _req: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const product = await getProductBySlug(params.slug);
    if (!product) {
      throw new AppError("PRODUCT_NOT_FOUND");
    }

    const rating = await getProductRatingSummary(product.id);

    return Response.json({ product, rating });
  } catch (error) {
    return errorResponse(error);
  }
}
