import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/rbac";
import { getVerificationQueue } from "@/lib/sellers/verification.service";
import { AppError, errorResponse } from "@/lib/errors";

export async function GET(req: NextRequest) {
  try {
    // requireAdmin() — not a manual role check — so this automatically
    // enforces the existing twoFactorVerified gate too, consistent with
    // every other /api/admin/* route in this codebase.
    const session = await requireAdmin();
    if (!session) throw new AppError("ADMIN_UNAUTHORISED");

    const page = Math.max(1, Number(req.nextUrl.searchParams.get("page") ?? "1"));
    const pageSize = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get("pageSize") ?? "20")));

    const queue = await getVerificationQueue({ page, pageSize });

    return Response.json(queue);
  } catch (error) {
    return errorResponse(error);
  }
}
