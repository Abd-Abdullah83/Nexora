// app/api/admin/listings/moderation/route.ts
// GET /api/admin/listings/moderation — paginated pending flags queue

import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/rbac";
import { getModerationQueue } from "@/lib/sellers/listing-moderation.service";
import { AppError, errorResponse } from "@/lib/errors";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) throw new AppError("ADMIN_UNAUTHORISED");

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20")));

    const result = await getModerationQueue({ page, pageSize });
    return Response.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
