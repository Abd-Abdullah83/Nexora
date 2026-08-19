import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { setCommissionRate } from "@/lib/wallet/commission.service";
import { updateCommissionSchema } from "@/lib/validation/override";
import { AppError, errorResponse } from "@/lib/errors";

// GET /api/admin/commission — current rates for both seller types
export async function GET() {
  try {
    const session = await requireAdmin();
    if (!session) throw new AppError("ADMIN_UNAUTHORISED");

    // Get the currently active (open-ended) rate for each seller type
    const [individual, business] = await Promise.all([
      prisma.commissionConfig.findFirst({
        where: { sellerType: "individual", effectiveTo: null },
        orderBy: { effectiveFrom: "desc" },
      }),
      prisma.commissionConfig.findFirst({
        where: { sellerType: "business", effectiveTo: null },
        orderBy: { effectiveFrom: "desc" },
      }),
    ]);

    // Also fetch recent history for display
    const history = await prisma.commissionConfig.findMany({
      orderBy: { effectiveFrom: "desc" },
      take: 20,
    });

    return Response.json({
      current: {
        individual: individual
          ? { ratePercent: Number(individual.ratePercent), effectiveFrom: individual.effectiveFrom }
          : null,
        business: business
          ? { ratePercent: Number(business.ratePercent), effectiveFrom: business.effectiveFrom }
          : null,
      },
      history,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

// PUT /api/admin/commission — update rate for one seller type
// Closes the current open-ended row and starts a new one.
export async function PUT(req: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) throw new AppError("ADMIN_UNAUTHORISED");

    const body = await req.json().catch(() => ({}));
    const parsed = updateCommissionSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError("VALIDATION_ERROR", parsed.error.flatten().fieldErrors);
    }

    const newConfig = await setCommissionRate(
      parsed.data.sellerType as any,
      parsed.data.newRatePercent
    );

    return Response.json({
      config: newConfig,
      message: `Commission rate for ${parsed.data.sellerType} sellers updated to ${parsed.data.newRatePercent}%. Takes effect on new orders immediately.`,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
