import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/rbac";
import { approveBanEvasionAlert } from "@/lib/sellers/ban-evasion.service";
import { resolveBanEvasionAlertSchema } from "@/lib/validation/seller-enforcement";
import { AppError, errorResponse } from "@/lib/errors";

// POST /api/admin/ban-evasion-alerts/[id]/approve
// Admin confirms the identity match is NOT ban evasion — clears the
// block on activation for the new seller. Requires a documented reason.

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAdmin();
    if (!session) throw new AppError("ADMIN_UNAUTHORISED");

    const body = await req.json().catch(() => ({}));
    const parsed = resolveBanEvasionAlertSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError("VALIDATION_ERROR", parsed.error.flatten().fieldErrors);
    }

    await approveBanEvasionAlert(params.id, session.userId, parsed.data.adminNote);

    return Response.json({
      message: "Alert approved — seller can now be activated.",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
