import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/rbac";
import { reinstateSeller } from "@/lib/sellers/admin-seller.service";
import { reinstateSellerSchema } from "@/lib/validation/seller-enforcement";
import { AppError, errorResponse } from "@/lib/errors";

// POST /api/admin/sellers/[id]/reinstate
// Lifts a suspension or ban. If reinstating a banned seller, unfreezes
// their escrow holds so the release job resumes processing them.

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAdmin();
    if (!session) throw new AppError("ADMIN_UNAUTHORISED");

    const body = await req.json().catch(() => ({}));
    const parsed = reinstateSellerSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError("VALIDATION_ERROR", parsed.error.flatten().fieldErrors);
    }

    const result = await reinstateSeller({
      sellerId: params.id,
      adminUserId: session.userId,
      reason: parsed.data.reason,
    });

    return Response.json({
      ...result,
      message: "Seller reinstated to active status.",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
