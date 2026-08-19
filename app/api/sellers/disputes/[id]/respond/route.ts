// app/api/sellers/disputes/[id]/respond/route.ts
// POST — seller accepts, rejects, or escalates a dispute

import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { rateLimit } from "@/lib/security/rate-limit";
import { sellerRespondToDispute } from "@/lib/sellers/dispute.service";
import { sellerRespondSchema } from "@/lib/validation/dispute";
import { AppError, errorResponse } from "@/lib/errors";

async function getActiveSeller(userId: string) {
  const seller = await prisma.seller.findUnique({
    where: { userId },
    select: { id: true, status: true },
  });
  if (!seller || seller.status !== "active") throw new AppError("ADMIN_UNAUTHORISED");
  return seller;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session) throw new AppError("AUTH_REQUIRED");

    const { allowed } = await rateLimit(`seller:dispute-respond:${session.userId}`, 20, 3600);
    if (!allowed) throw new AppError("RATE_LIMIT_EXCEEDED");

    const seller = await getActiveSeller(session.userId);

    const body = await req.json().catch(() => ({}));
    const parsed = sellerRespondSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError("VALIDATION_ERROR", parsed.error.flatten().fieldErrors);
    }

    const dispute = await sellerRespondToDispute({
      disputeId: params.id,
      sellerUserId: session.userId,
      sellerId: seller.id,
      input: parsed.data,
    });

    const actionLabel =
      parsed.data.action === "accept"
        ? "accepted — full refund issued"
        : parsed.data.action === "escalate"
        ? "escalated to admin review"
        : "rejected — dispute moves to seller review";

    return Response.json({ dispute, message: `Dispute ${actionLabel}.` });
  } catch (error) {
    return errorResponse(error);
  }
}
