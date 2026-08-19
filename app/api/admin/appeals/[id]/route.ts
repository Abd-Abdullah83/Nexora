// app/api/admin/appeals/[id]/route.ts
// GET — full appeal thread + seller context

import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/rbac";
import { getAppealForAdmin } from "@/lib/sellers/appeal.service";
import { AppError, errorResponse } from "@/lib/errors";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAdmin();
    if (!session) throw new AppError("ADMIN_UNAUTHORISED");

    const appeal = await getAppealForAdmin(params.id);
    return Response.json({ appeal });
  } catch (error) {
    return errorResponse(error);
  }
}
