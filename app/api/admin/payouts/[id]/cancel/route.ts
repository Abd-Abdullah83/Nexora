import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/rbac";
import { adminCancelPayout } from "@/lib/wallet/payout.service";
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

    const payout = await adminCancelPayout(
      params.id,
      session.userId,
      parsed.success ? parsed.data.adminNote : undefined
    );
    return Response.json({ payout, message: "Payout cancelled by admin." });
  } catch (error) {
    return errorResponse(error);
  }
}
