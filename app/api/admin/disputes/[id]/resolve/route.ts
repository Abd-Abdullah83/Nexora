import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/rbac";
import { adminResolveDispute } from "@/lib/sellers/dispute.service";
import { adminResolveSchema } from "@/lib/validation/dispute";
import { AppError, errorResponse } from "@/lib/errors";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAdmin();
    if (!session) throw new AppError("ADMIN_UNAUTHORISED");

    const body = await req.json().catch(() => ({}));
    const parsed = adminResolveSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError("VALIDATION_ERROR", parsed.error.flatten().fieldErrors);
    }

    const dispute = await adminResolveDispute({
      disputeId: params.id,
      adminUserId: session.userId,
      input: parsed.data,
    });

    return Response.json({
      dispute,
      message: parsed.data.outcome === "refund"
        ? `Dispute resolved — refund of ${parsed.data.refundAmount ?? "full amount"} issued and ledger updated.`
        : "Dispute denied — escrow hold returned to normal release queue.",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
