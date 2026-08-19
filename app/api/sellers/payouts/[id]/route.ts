// app/api/sellers/payouts/[id]/route.ts
// DELETE — cancel a seller's own payout (only if still "requested")

import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { cancelPayoutRequest } from "@/lib/wallet/payout.service";
import { AppError, errorResponse } from "@/lib/errors";

async function getActiveSeller(userId: string) {
  const seller = await prisma.seller.findUnique({ where: { userId }, select: { id: true, status: true } });
  if (!seller || seller.status !== "active") throw new AppError("ADMIN_UNAUTHORISED");
  return seller;
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session) throw new AppError("AUTH_REQUIRED");
    const seller = await getActiveSeller(session.userId);

    const payout = await cancelPayoutRequest(params.id, seller.id, session.userId);
    return Response.json({ payout, message: "Payout request cancelled." });
  } catch (error) {
    return errorResponse(error);
  }
}
