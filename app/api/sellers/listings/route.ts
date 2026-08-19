// app/api/sellers/listings/route.ts
// GET  /api/sellers/listings  — paginated listing of the seller's own products
// POST /api/sellers/listings  — create a new product listing

import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { rateLimit, getClientIp } from "@/lib/security/rate-limit";
import { getListingsForSeller, createListing } from "@/lib/sellers/listings.service";
import { sellerListingCreateSchema } from "@/lib/validation/seller-listing";
import { AppError, errorResponse } from "@/lib/errors";

async function getActiveSeller(userId: string) {
  const seller = await prisma.seller.findUnique({
    where: { userId },
    select: { id: true, status: true, sellerType: true },
  });
  if (!seller) throw new AppError("VALIDATION_ERROR", { seller: "Seller account not found." });
  if (seller.status !== "active") throw new AppError("ADMIN_UNAUTHORISED");
  return seller;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) throw new AppError("AUTH_REQUIRED");

    const seller = await getActiveSeller(session.userId);

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") as "draft" | "active" | "archived" | null;
    const page = Number(searchParams.get("page") ?? "1");
    const pageSize = Number(searchParams.get("pageSize") ?? "20");

    const data = await getListingsForSeller(seller.id, { status: status ?? undefined, page, pageSize });

    return Response.json(data);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  try {
    const session = await getSession();
    if (!session) throw new AppError("AUTH_REQUIRED");

    // Tighter rate limit on creation — prevents catalogue spam
    const { allowed } = await rateLimit(`seller:listings:create:${session.userId}`, 30, 3600);
    if (!allowed) throw new AppError("RATE_LIMIT_EXCEEDED");

    const seller = await getActiveSeller(session.userId);

    const body = await req.json().catch(() => ({}));
    const parsed = sellerListingCreateSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError("VALIDATION_ERROR", parsed.error.flatten().fieldErrors);
    }

    const product = await createListing(seller.id, session.userId, parsed.data);

    return Response.json({ product }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
