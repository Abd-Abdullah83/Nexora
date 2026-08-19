import { requireAdmin } from "@/lib/auth/rbac";
import { getPlatformKPIs } from "@/lib/admin/platform-analytics.service";
import { AppError, errorResponse } from "@/lib/errors";

// GET /api/admin/overview — platform KPIs for admin dashboard
export async function GET() {
  try {
    const session = await requireAdmin();
    if (!session) throw new AppError("ADMIN_UNAUTHORISED");

    const kpis = await getPlatformKPIs();
    return Response.json(kpis);
  } catch (error) {
    return errorResponse(error);
  }
}
