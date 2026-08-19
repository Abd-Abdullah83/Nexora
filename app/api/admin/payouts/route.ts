import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/rbac";
import { getPayoutQueue } from "@/lib/wallet/payout.service";
import { AppError, errorResponse } from "@/lib/errors";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) throw new AppError("ADMIN_UNAUTHORISED");

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") ?? "pending";
    const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const pageSize = Math.min(50, Math.max(1, Number(searchParams.get("pageSize") ?? "25")));

    const data = await getPayoutQueue({ status, page, pageSize });
    return Response.json(data);
  } catch (error) {
    return errorResponse(error);
  }
}
