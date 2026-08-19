import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/rbac";
import { getListingReviewQueue } from "@/lib/sellers/listing-approval.service";
import { AppError, errorResponse } from "@/lib/errors";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) throw new AppError("ADMIN_UNAUTHORISED");

    const page = Number(req.nextUrl.searchParams.get("page") ?? "1");
    const pageSize = Number(req.nextUrl.searchParams.get("pageSize") ?? "20");

    const queue = await getListingReviewQueue({ page, pageSize });
    return Response.json(queue);
  } catch (error) {
    return errorResponse(error);
  }
}
