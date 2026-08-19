// app/api/admin/sellers/[id]/route.ts
// GET — full seller detail for admin (verifications, bans, wallet, alerts)

import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/rbac";
import { getSellerDetailForAdmin } from "@/lib/sellers/admin-seller.service";
import { AppError, errorResponse } from "@/lib/errors";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAdmin();
    if (!session) throw new AppError("ADMIN_UNAUTHORISED");

    const seller = await getSellerDetailForAdmin(params.id);
    return Response.json({ seller });
  } catch (error) {
    return errorResponse(error);
  }
}
