import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/rbac";
import { requestProductBan } from "@/lib/admin/product-enforcement.service";
import { requestProductBanSchema } from "@/lib/validation/product-enforcement";
import { AppError, errorResponse } from "@/lib/errors";

// POST /api/admin/products/[id]/ban
//
// Does NOT ban the listing immediately. Creates a ProductBanRequest
// (status: pending) — the actual ban only executes once a DIFFERENT
// admin confirms it via POST /api/admin/products/[id]/ban-request/confirm.
// Mirrors the exact same two-step pattern used for seller-level bans in
// lib/sellers/admin-seller.service.ts.

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAdmin();
    if (!session) throw new AppError("ADMIN_UNAUTHORISED");

    const body = await req.json().catch(() => ({}));
    const parsed = requestProductBanSchema.safeParse(body);
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", parsed.error.flatten().fieldErrors);

    const request = await requestProductBan({
      productId: params.id,
      adminUserId: session.userId,
      reason: parsed.data.reason,
    });

    return Response.json({
      request,
      message:
        "Ban requested. A different admin must confirm it before it takes effect — the listing has not been banned yet.",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
