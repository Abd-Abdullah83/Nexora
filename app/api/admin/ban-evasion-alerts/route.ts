import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/rbac";
import { getPendingBanEvasionAlerts } from "@/lib/sellers/ban-evasion.service";
import { AppError, errorResponse } from "@/lib/errors";

// GET /api/admin/ban-evasion-alerts
// Returns pending alerts for the admin review queue.
// Used by AdminLayout badge fetch and the /admin/ban-evasion-alerts page.

export async function GET(req: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) throw new AppError("ADMIN_UNAUTHORISED");

    const { searchParams } = new URL(req.url);
    const page     = Math.max(1, parseInt(searchParams.get("page")     ?? "1"));
    const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") ?? "25")));

    const result = await getPendingBanEvasionAlerts({ page, pageSize });
    return Response.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
