// app/api/admin/support/route.ts
// GET /api/admin/support — paginated support ticket queue

import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/rbac";
import { getAdminTicketQueue } from "@/lib/sellers/support-tickets.service";
import { AppError, errorResponse } from "@/lib/errors";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) throw new AppError("ADMIN_UNAUTHORISED");

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") ?? undefined;
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const pageSize = Math.min(50, parseInt(searchParams.get("pageSize") ?? "25"));

    const result = await getAdminTicketQueue({ status, page, pageSize });
    return Response.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
