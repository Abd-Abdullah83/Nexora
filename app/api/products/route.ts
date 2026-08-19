import { NextRequest } from "next/server";
import { getProducts } from "@/lib/repositories/product.repository";
import { productSearchSchema } from "@/lib/validation/product";
import { rateLimit, getClientIp } from "@/lib/security/rate-limit";
import { cached, CacheKeys } from "@/lib/cache/product-cache";
import { AppError, errorResponse } from "@/lib/errors";

export async function GET(req: NextRequest) {
  const ip = getClientIp(req.headers);

  try {
    // General-purpose rate limit per the project's API security plan
    // (100/min for general endpoints) — protects search from abuse/scraping.
    const { allowed, retryAfterSeconds } = await rateLimit(`products-list:${ip}`, 100, 60);
    if (!allowed) {
      throw new AppError("RATE_LIMIT_EXCEEDED", { retryAfterSeconds });
    }

    const params = req.nextUrl.searchParams;
    const parsed = productSearchSchema.safeParse({
      q: params.get("q") || undefined,
      category: params.get("category") || undefined,
      minPrice: params.get("minPrice") || undefined,
      maxPrice: params.get("maxPrice") || undefined,
      sort: params.get("sort") || undefined,
      page: params.get("page") || undefined,
      pageSize: params.get("pageSize") || undefined,
    });

    if (!parsed.success) {
      throw new AppError("VALIDATION_ERROR", parsed.error.flatten());
    }
    const filters = parsed.data;

    const cacheKey = CacheKeys.productsList(JSON.stringify(filters));

    const result = await cached(
      cacheKey,
      () =>
        getProducts({
          categorySlug: filters.category,
          minPrice: filters.minPrice,
          maxPrice: filters.maxPrice,
          searchQuery: filters.q,
          sort: filters.sort,
          page: filters.page ?? 1,
          pageSize: filters.pageSize ?? 24,
        }),
      120
    );

    return Response.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
