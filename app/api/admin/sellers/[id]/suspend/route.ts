import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/rbac";
import { suspendSeller } from "@/lib/sellers/admin-seller.service";
import { suspendSellerSchema } from "@/lib/validation/seller-enforcement";
import { AppError, errorResponse } from "@/lib/errors";

// POST /api/admin/sellers/[id]/suspend
// Temporarily suspends an active seller (reversible via /reinstate).
// Blocks dashboard access and payout requests immediately.

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAdmin();
    if (!session) throw new AppError("ADMIN_UNAUTHORISED");

    const body = await req.json().catch(() => ({}));
    const parsed = suspendSellerSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError("VALIDATION_ERROR", parsed.error.flatten().fieldErrors);
    }

    const result = await suspendSeller({
      sellerId: params.id,
      adminUserId: session.userId,
      reason: parsed.data.reason,
      suspendedUntil: parsed.data.suspendedUntil
        ? new Date(parsed.data.suspendedUntil)
        : undefined,
    });

    return Response.json({
      ...result,
      message: parsed.data.suspendedUntil
        ? `Seller suspended until ${new Date(parsed.data.suspendedUntil).toLocaleDateString()}.`
        : "Seller suspended indefinitely. Use /reinstate to lift.",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
