// app/api/sellers/payouts/route.ts
// GET  — paginated payout history
// POST — request a new payout

import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { rateLimit } from "@/lib/security/rate-limit";
import { getPayoutHistory, requestPayout } from "@/lib/wallet/payout.service";
import { payoutRequestSchema } from "@/lib/validation/payout";
import { AppError, errorResponse } from "@/lib/errors";

async function getActiveSeller(userId: string) {
  const seller = await prisma.seller.findUnique({ where: { userId }, select: { id: true, status: true } });
  if (!seller || seller.status !== "active") throw new AppError("ADMIN_UNAUTHORISED");
  return seller;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) throw new AppError("AUTH_REQUIRED");
    const seller = await getActiveSeller(session.userId);

    const { searchParams } = new URL(req.url);
    const page = Number(searchParams.get("page") ?? "1");
    const pageSize = Number(searchParams.get("pageSize") ?? "20");

    const data = await getPayoutHistory(seller.id, { page, pageSize });
    return Response.json(data);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) throw new AppError("AUTH_REQUIRED");

    // Tighter rate limit — payout requests are financial operations
    const { allowed } = await rateLimit(`seller:payouts:request:${session.userId}`, 5, 3600);
    if (!allowed) throw new AppError("RATE_LIMIT_EXCEEDED");

    const seller = await getActiveSeller(session.userId);
    const body = await req.json().catch(() => ({}));
    const parsed = payoutRequestSchema.safeParse(body);
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", parsed.error.flatten().fieldErrors);

    const payout = await requestPayout(seller.id, session.userId, parsed.data);
    return Response.json({ payout }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
