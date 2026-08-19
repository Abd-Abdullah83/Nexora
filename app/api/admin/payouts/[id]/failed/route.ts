import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/rbac";
import { markPayoutFailed } from "@/lib/wallet/payout.service";
import { adminPayoutActionSchema } from "@/lib/validation/payout";
import { AppError, errorResponse } from "@/lib/errors";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAdmin();
    if (!session) throw new AppError("ADMIN_UNAUTHORISED");

    const body = await req.json().catch(() => ({}));
    const parsed = adminPayoutActionSchema.safeParse(body);
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", parsed.error.flatten().fieldErrors);

    if (!parsed.data.adminNote?.trim()) {
      throw new AppError("VALIDATION_ERROR", { adminNote: "A reason is required when marking a payout failed." });
    }

    const payout = await markPayoutFailed(params.id, session.userId, parsed.data.adminNote);
    return Response.json({ payout, message: "Payout marked as failed. Balance unchanged." });
  } catch (error) {
    return errorResponse(error);
  }
}
