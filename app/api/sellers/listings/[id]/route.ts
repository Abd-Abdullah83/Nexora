// app/api/sellers/listings/[id]/route.ts
// GET    — fetch one of the seller's own listings
// PUT    — update it
// DELETE — soft-archive it (sets deletedAt + status=archived)

import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { rateLimit } from "@/lib/security/rate-limit";
import {
  getListingForSeller,
  updateListing,
  archiveListing,
} from "@/lib/sellers/listings.service";
import { sellerListingUpdateSchema } from "@/lib/validation/seller-listing";
import { AppError, errorResponse } from "@/lib/errors";

async function getActiveSeller(userId: string) {
  const seller = await prisma.seller.findUnique({
    where: { userId },
    select: { id: true, status: true },
  });
  if (!seller) throw new AppError("VALIDATION_ERROR", { seller: "Seller account not found." });
  if (seller.status !== "active") throw new AppError("ADMIN_UNAUTHORISED");
  return seller;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session) throw new AppError("AUTH_REQUIRED");

    const seller = await getActiveSeller(session.userId);
    // getListingForSeller enforces sellerId ownership at the DB level
    const product = await getListingForSeller(params.id, seller.id);

    return Response.json({ product });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session) throw new AppError("AUTH_REQUIRED");

    const { allowed } = await rateLimit(`seller:listings:update:${session.userId}`, 60, 60);
    if (!allowed) throw new AppError("RATE_LIMIT_EXCEEDED");

    const seller = await getActiveSeller(session.userId);

    const body = await req.json().catch(() => ({}));
    const parsed = sellerListingUpdateSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError("VALIDATION_ERROR", parsed.error.flatten().fieldErrors);
    }

    const product = await updateListing(params.id, seller.id, session.userId, parsed.data);

    return Response.json({ product });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session) throw new AppError("AUTH_REQUIRED");

    const seller = await getActiveSeller(session.userId);

    await archiveListing(params.id, seller.id, session.userId);

    return Response.json({ message: "Listing archived." });
  } catch (error) {
    return errorResponse(error);
  }
}
