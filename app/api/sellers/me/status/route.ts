// app/api/sellers/me/status/route.ts
//
// GET /api/sellers/me/status
//
// Lightweight endpoint so Seller Central can show a clear, in-app
// "you are suspended/banned" banner, instead of every individual page
// silently failing with a generic "You do not have permission to perform
// this action." message and no explanation anywhere.
//
// CRITICAL: uses requireSeller() ONLY — deliberately does NOT check
// seller.status === "active", same reasoning as /api/sellers/appeal.
// A suspended/banned seller needs to be able to read their OWN status —
// that's the whole point of this endpoint. If it required "active" status
// to work, it would 403 for exactly the sellers who need it most.

import { requireSeller } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { AppError, errorResponse } from "@/lib/errors";

export async function GET() {
  try {
    const session = await requireSeller();
    if (!session) throw new AppError("AUTH_REQUIRED");

    const seller = await prisma.seller.findUnique({
      where: { id: session.sellerId! },
      select: {
        status: true,
        banReason: true,
        bannedAt: true,
        suspendedUntil: true,
      },
    });

    if (!seller) throw new AppError("VALIDATION_ERROR", { seller: "Seller account not found." });

    // Also surface whether an open appeal already exists, so the UI can
    // say "Appeal sent — awaiting response" vs "Appeal this decision"
    // without a second round-trip.
    const appeal = await prisma.sellerAppeal.findFirst({
      where: { sellerId: session.sellerId! },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true },
    });

    return Response.json({
      status: seller.status,
      banReason: seller.banReason,
      bannedAt: seller.bannedAt,
      suspendedUntil: seller.suspendedUntil,
      appeal: appeal ? { id: appeal.id, status: appeal.status } : null,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
