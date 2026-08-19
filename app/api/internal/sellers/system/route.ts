import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { AppError, errorResponse } from "@/lib/errors";

/**
 * GET /api/internal/sellers/system
 *
 * Returns the platform's synthetic "Nexora Official Store" seller record —
 * the seller that every pre-existing product was backfilled to in Phase 1.
 *
 * Internal use only: gated behind requireAdmin() rather than exposed to
 * sellers or buyers. There is no current frontend caller for this in
 * Phase 1; it exists so later phases (and ad-hoc admin tooling/scripts)
 * have a stable way to look up the system seller's id without
 * hardcoding it or querying the database directly.
 */
export async function GET(_req: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) throw new AppError("ADMIN_UNAUTHORISED");

    const systemSeller = await prisma.seller.findFirst({
      where: { isSystemSeller: true },
      select: {
        id: true,
        sellerType: true,
        status: true,
        createdAt: true,
        user: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });

    if (!systemSeller) {
      throw new AppError("SERVER_ERROR");
    }

    return Response.json({ seller: systemSeller });
  } catch (error) {
    return errorResponse(error);
  }
}
