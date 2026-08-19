import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/rbac";
import { getProducts, createProduct, slugExists, skuExists } from "@/lib/repositories/product.repository";
import { createProductSchema } from "@/lib/validation/product";
import { generateUniqueSlug } from "@/lib/utils/slug";
import { rateLimit, getClientIp } from "@/lib/security/rate-limit";
import { logAuditEvent } from "@/lib/audit";
import { invalidateCache, CacheKeys } from "@/lib/cache/product-cache";
import { AppError, errorResponse } from "@/lib/errors";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) throw new AppError("ADMIN_UNAUTHORISED");

    const params = req.nextUrl.searchParams;
    const result = await getProducts({
      categorySlug: params.get("category") || undefined,
      searchQuery: params.get("q") || undefined,
      status: (params.get("status") as "draft" | "active" | "archived") || undefined,
      includeAllStatuses: !params.get("status"),
      page: params.get("page") ? Number(params.get("page")) : 1,
      pageSize: params.get("pageSize") ? Number(params.get("pageSize")) : 20,
    });

    return Response.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);

  try {
    const session = await requireAdmin();
    if (!session) throw new AppError("ADMIN_UNAUTHORISED");

    const { allowed, retryAfterSeconds } = await rateLimit(
      `admin-product-create:${session.userId}`,
      30,
      60
    );
    if (!allowed) throw new AppError("RATE_LIMIT_EXCEEDED", { retryAfterSeconds });

    const body = await req.json();
    const parsed = createProductSchema.safeParse(body);
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", parsed.error.flatten());
    const data = parsed.data;
    console.log("Parsed data:", JSON.stringify(data, null, 2));

    if (await skuExists(data.sku)) {
      throw new AppError("VALIDATION_ERROR", { sku: "This SKU is already in use." });
    }

    const slug = await generateUniqueSlug(data.name, slugExists);

    const product = await createProduct({
      name: data.name,
      slug,
      description: data.description,
      shortDescription: data.shortDescription,
      price: data.price,
      comparePrice: data.comparePrice ?? undefined,
      costPrice: data.costPrice ?? undefined,
      // ── Sale / discount fields ─────────────────────────────────────────
      salePrice: data.salePrice ?? undefined,
      saleEndsAt: data.saleEndsAt ? new Date(data.saleEndsAt) : undefined,
      // ──────────────────────────────────────────────────────────────────
      category: { connect: { id: data.categoryId } },
      sku: data.sku,
      stockQty: data.stockQty,
      lowStockThreshold: data.lowStockThreshold,
      weightGrams: data.weightGrams ?? undefined,
      status: data.status,
      isFeatured: data.isFeatured,
      isBestSeller: data.isBestSeller,
      isNewArrival: data.isNewArrival,
      tags: data.tags ?? [],
      metaTitle: data.metaTitle,
      metaDescription: data.metaDescription,
    });

    await invalidateCache(CacheKeys.productsAll);

    await logAuditEvent({
      userId: session.userId,
      action: "product.create",
      resourceType: "product",
      resourceId: product.id,
      newValues: product,
      ipAddress: ip,
      userAgent: req.headers.get("user-agent"),
    });

    return Response.json({ product }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
