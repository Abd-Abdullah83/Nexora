import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { rateLimit } from "@/lib/security/rate-limit";
import {
  getTaxSettings,
  upsertTaxSettings,
} from "@/lib/sellers/settings.service";
import { taxSettingsSchema } from "@/lib/validation/seller-store";
import { AppError, errorResponse } from "@/lib/errors";

// Tax registration numbers are sensitive business data — access is
// restricted to the owning seller and admin, per the Phase 4 security
// review. This route serves the seller; the admin can access it via the
// seller detail view in the admin panel (not yet built, Phase 12 scope).
// The public storefront NEVER gets this data — store.service.ts's
// getPublicStoreBySlug() selects only display fields, no settings.
async function getActiveSeller(userId: string) {
  const seller = await prisma.seller.findUnique({
    where: { userId },
    select: { id: true, status: true },
  });
  if (!seller) throw new AppError("VALIDATION_ERROR", { seller: "Seller account not found." });
  if (seller.status !== "active") throw new AppError("ADMIN_UNAUTHORISED");
  return seller;
}

export async function GET(_req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) throw new AppError("AUTH_REQUIRED");
    const seller = await getActiveSeller(session.userId);
    const settings = await getTaxSettings(seller.id);
    return Response.json({ settings: settings ?? null });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) throw new AppError("AUTH_REQUIRED");

    const { allowed } = await rateLimit(`seller:tax:${session.userId}`, 20, 60);
    if (!allowed) throw new AppError("RATE_LIMIT_EXCEEDED");

    const seller = await getActiveSeller(session.userId);
    const body = await req.json().catch(() => ({}));
    const parsed = taxSettingsSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError("VALIDATION_ERROR", parsed.error.flatten().fieldErrors);
    }

    const settings = await upsertTaxSettings(seller.id, parsed.data);
    return Response.json({ settings });
  } catch (error) {
    return errorResponse(error);
  }
}
