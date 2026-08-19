// app/api/admin/sellers/route.ts
// GET /api/admin/sellers — paginated seller list with status/type/search filters.
// This is the route the AdminLayout "Sellers" nav link has been waiting for
// since Phase 10 built the link but left the page as a 404.

import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/rbac";
import { listSellersForAdmin } from "@/lib/sellers/admin-seller.service";
import { listSellersQuerySchema } from "@/lib/validation/seller-enforcement";
import { AppError, errorResponse } from "@/lib/errors";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) throw new AppError("ADMIN_UNAUTHORISED");

    const { searchParams } = new URL(req.url);
    const parsed = listSellersQuerySchema.safeParse({
      status:     searchParams.get("status")     ?? undefined,
      sellerType: searchParams.get("sellerType") ?? undefined,
      search:     searchParams.get("search")     ?? undefined,
      page:       searchParams.get("page")       ?? "1",
      pageSize:   searchParams.get("pageSize")   ?? "25",
    });

    if (!parsed.success) {
      throw new AppError("VALIDATION_ERROR", parsed.error.flatten().fieldErrors);
    }

    const result = await listSellersForAdmin(parsed.data);
    return Response.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
