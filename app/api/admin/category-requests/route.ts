import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/rbac";
import { getCategoryRequestQueue } from "@/lib/admin/category-request.service";
import { AppError, errorResponse } from "@/lib/errors";

// ── GET /api/admin/category-requests?status=pending ───────────────────────
export async function GET(req: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) throw new AppError("ADMIN_UNAUTHORISED");

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") as "pending" | "approved" | "rejected" | null;
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20")));

    const result = await getCategoryRequestQueue({
      status: status ?? undefined,
      page,
      pageSize,
    });
    return Response.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
