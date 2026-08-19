// app/api/sellers/disputes/route.ts
// GET /api/sellers/disputes — seller's dispute inbox
//
// FIX: The original seller-dispute-list-route.ts called
// getDisputesForSeller({ sellerId, status, page, pageSize }) as one object,
// but the service signature takes (sellerId: string, params: {...}) —
// two separate arguments. Fixed here.

import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getDisputesForSeller } from "@/lib/sellers/dispute.service";
import { AppError, errorResponse } from "@/lib/errors";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) throw new AppError("AUTH_REQUIRED");

    const seller = await prisma.seller.findUnique({
      where: { userId: session.userId },
      select: { id: true, status: true },
    });
    if (!seller || seller.status !== "active") throw new AppError("ADMIN_UNAUTHORISED");

    const { searchParams } = new URL(req.url);
    const status   = searchParams.get("status") ?? undefined;
    const page     = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20")));

    // Correct 2-arg call matching the service's actual signature
    const result = await getDisputesForSeller(seller.id, { status, page, pageSize });
    return Response.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
