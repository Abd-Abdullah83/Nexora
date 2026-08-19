import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { rateLimit } from "@/lib/security/rate-limit";
import { openDispute } from "@/lib/sellers/dispute.service";
import { openDisputeSchema } from "@/lib/validation/dispute";
import { AppError, errorResponse } from "@/lib/errors";

export async function POST(
  req: NextRequest,
  { params }: { params: { orderItemId: string } }
) {
  try {
    const session = await getSession();
    if (!session) throw new AppError("AUTH_REQUIRED");

    // 5 dispute opens per hour per user — prevents dispute-spam
    const { allowed } = await rateLimit(`buyer:dispute:${session.userId}`, 5, 3600);
    if (!allowed) throw new AppError("RATE_LIMIT_EXCEEDED");

    const body = await req.json().catch(() => ({}));
    const parsed = openDisputeSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError("VALIDATION_ERROR", parsed.error.flatten().fieldErrors);
    }

    const dispute = await openDispute({
      orderItemId: params.orderItemId,
      buyerUserId: session.userId,
      input: parsed.data,
    });

    return Response.json({ dispute, message: "Dispute opened. The seller will be notified." }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
