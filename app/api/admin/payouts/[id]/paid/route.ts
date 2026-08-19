import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/rbac";
import { markPayoutPaid } from "@/lib/wallet/payout.service";
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

    // markPayoutPaid posts the ledger entry and decrements availableBalance
    // atomically inside a $transaction — this is the ONLY place that
    // deducts from the seller's balance for a payout.
    const payout = await markPayoutPaid(params.id, session.userId, parsed.data.adminNote);
    return Response.json({ payout, message: "Payout marked as paid. Ledger updated." });
  } catch (error) {
    return errorResponse(error);
  }
}
