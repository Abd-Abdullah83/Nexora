import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/rbac";
import {
  manuallyReleaseEscrowHold,
  manuallyUnfreezeEscrowHold,
} from "@/lib/admin/overrides.service";
import { escrowReleaseSchema, escrowUnfreezeSchema } from "@/lib/validation/override";
import { AppError, errorResponse } from "@/lib/errors";

// POST /api/admin/overrides/escrow/[id]?action=release|unfreeze
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAdmin();
    if (!session) throw new AppError("ADMIN_UNAUTHORISED");

    const action = new URL(req.url).searchParams.get("action");
    if (!action || !["release", "unfreeze"].includes(action)) {
      throw new AppError("VALIDATION_ERROR", {
        action: "action query param must be 'release' or 'unfreeze'.",
      });
    }

    const body = await req.json().catch(() => ({}));

    if (action === "release") {
      const parsed = escrowReleaseSchema.safeParse(body);
      if (!parsed.success) throw new AppError("VALIDATION_ERROR", parsed.error.flatten().fieldErrors);
      const result = await manuallyReleaseEscrowHold({
        escrowHoldId: params.id,
        adminId: session.userId,
        reason: parsed.data.reason,
      });
      return Response.json({ ...result, message: "Escrow hold manually released. Seller balance credited." });
    } else {
      const parsed = escrowUnfreezeSchema.safeParse(body);
      if (!parsed.success) throw new AppError("VALIDATION_ERROR", parsed.error.flatten().fieldErrors);
      const result = await manuallyUnfreezeEscrowHold({
        escrowHoldId: params.id,
        adminId: session.userId,
        reason: parsed.data.reason,
      });
      return Response.json({ ...result, message: "Escrow hold unfrozen — back to normal held state." });
    }
  } catch (error) {
    return errorResponse(error);
  }
}
