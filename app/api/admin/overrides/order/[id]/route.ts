import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/rbac";
import { forceCompleteOrder, forceCancelOrder } from "@/lib/admin/overrides.service";
import { orderForceCompleteSchema, orderForceCancelSchema } from "@/lib/validation/override";
import { AppError, errorResponse } from "@/lib/errors";

// POST /api/admin/overrides/order/[id]?action=complete|cancel
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAdmin();
    if (!session) throw new AppError("ADMIN_UNAUTHORISED");

    const action = new URL(req.url).searchParams.get("action");
    if (!action || !["complete", "cancel"].includes(action)) {
      throw new AppError("VALIDATION_ERROR", {
        action: "action query param must be 'complete' or 'cancel'.",
      });
    }

    const body = await req.json().catch(() => ({}));

    if (action === "complete") {
      const parsed = orderForceCompleteSchema.safeParse(body);
      if (!parsed.success) throw new AppError("VALIDATION_ERROR", parsed.error.flatten().fieldErrors);
      const result = await forceCompleteOrder({
        orderId: params.id,
        adminId: session.userId,
        reason: parsed.data.reason,
      });
      return Response.json({ ...result, message: "Order force-completed and marked delivered." });
    } else {
      const parsed = orderForceCancelSchema.safeParse(body);
      if (!parsed.success) throw new AppError("VALIDATION_ERROR", parsed.error.flatten().fieldErrors);
      const result = await forceCancelOrder({
        orderId: params.id,
        adminId: session.userId,
        reason: parsed.data.reason,
      });
      return Response.json({ ...result, message: "Order force-cancelled." });
    }
  } catch (error) {
    return errorResponse(error);
  }
}
