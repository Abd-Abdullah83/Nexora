// app/api/admin/escrow/[id]/hold/route.ts
//
// Phase 7 — POST /api/admin/escrow/:id/hold, per the doc's exact API
// contract: "Admin manually extends a hold with a reason (audit-logged)."
// Calling this on an already-frozen hold is allowed (overwrites the
// reason) — freezeEscrowHold() itself only blocks freezing an already-
// "released" hold, which is the one state that genuinely can't be
// reversed by this route.

import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/rbac";
import { freezeEscrowHold } from "@/lib/wallet/escrow.service";
import { freezeEscrowSchema } from "@/lib/validation/escrow";
import { AppError, errorResponse } from "@/lib/errors";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    if (!session) throw new AppError("ADMIN_UNAUTHORISED");

    const body = await req.json();
    const parsed = freezeEscrowSchema.safeParse(body);
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", parsed.error.flatten());

    const hold = await freezeEscrowHold({
      escrowHoldId: params.id,
      reason: parsed.data.reason,
      adminUserId: session.userId,
    });

    return Response.json({ escrowHold: hold });
  } catch (error) {
    return errorResponse(error);
  }
}
