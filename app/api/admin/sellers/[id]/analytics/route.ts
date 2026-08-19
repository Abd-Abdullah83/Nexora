// app/api/admin/sellers/[id]/analytics/route.ts
// Phase 10 — admin-only view of a specific seller's analytics data.
// Same data shape as GET /api/sellers/analytics but scoped to any seller
// by ID rather than the caller's own seller record.

import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { getFullSellerAnalytics } from "@/lib/sellers/analytics.service";
import { AppError, errorResponse } from "@/lib/errors";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAdmin();
    if (!session) throw new AppError("ADMIN_UNAUTHORISED");

    // Verify the seller actually exists before querying analytics
    const seller = await prisma.seller.findUnique({
      where: { id: params.id },
      select: { id: true, displayName: true, status: true },
    });
    if (!seller) throw new AppError("VALIDATION_ERROR", { id: "Seller not found." });

    const { searchParams } = new URL(req.url);
    const days = Math.min(90, Math.max(7, parseInt(searchParams.get("days") ?? "30")));

    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(toDate.getDate() - days);

    const analytics = await getFullSellerAnalytics({ sellerId: params.id, fromDate, toDate });
    return Response.json({ seller, analytics });
  } catch (error) {
    return errorResponse(error);
  }
}
