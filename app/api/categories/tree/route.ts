import { getActiveCategoryTree } from "@/lib/repositories/category.repository";
import { cached } from "@/lib/cache/product-cache";
import { errorResponse } from "@/lib/errors";

// Public, read-only — returns the active category tree (with nested
// children) for storefront navigation. Separate from /api/categories,
// which returns a flat list; the mega menu needs the nested shape.
export async function GET() {
  try {
    const tree = await cached("cache:categories:tree", () => getActiveCategoryTree(), 600);
    return Response.json({ tree });
  } catch (error) {
    return errorResponse(error);
  }
}
