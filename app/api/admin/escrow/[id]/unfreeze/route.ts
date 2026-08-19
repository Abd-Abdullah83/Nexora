// app/api/admin/escrow/[id]/unfreeze/route.ts
//
// Not in the doc's literal API contract (only POST .../hold is listed),
// but necessary: without an unfreeze action, /hold would be a one-way
// door — a frozen hold could never return to "held" and become
// release-eligible again. unfreezeEscrowHold() already existed in
// escrow.service.ts for exactly this; this route is just wiring it up.

import { requireAdmin } from "@/lib/auth/rbac";
import { unfreezeEscrowHold } from "@/lib/wallet/escrow.service";
import { AppError, errorResponse } from "@/lib/errors";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    if (!session) throw new AppError("ADMIN_UNAUTHORISED");

    const hold = await unfreezeEscrowHold(params.id, session.userId);

    return Response.json({ escrowHold: hold });
  } catch (error) {
    return errorResponse(error);
  }
}
