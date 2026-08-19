// app/api/admin/appeals/route.ts
// GET /api/admin/appeals — queue of seller appeals

import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/rbac";
import { getAppealQueueForAdmin } from "@/lib/sellers/appeal.service";
import { AppError, errorResponse } from "@/lib/errors";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) throw new AppError("ADMIN_UNAUTHORISED");

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") ?? "open";
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const pageSize = Math.min(50, parseInt(searchParams.get("pageSize") ?? "25"));

    const result = await getAppealQueueForAdmin({ status, page, pageSize });
    return Response.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
