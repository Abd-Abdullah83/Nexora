// app/api/sellers/promotions/route.ts
import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { rateLimit, getClientIp } from "@/lib/security/rate-limit";
import { createPromotion, listSellerPromotions } from "@/lib/sellers/promotions.service";
import { createPromotionSchema } from "@/lib/validation/promotion";
import { AppError, errorResponse } from "@/lib/errors";

async function getActiveSeller(userId: string) {
  const seller = await prisma.seller.findUnique({ where: { userId }, select: { id: true, status: true } });
  if (!seller || seller.status !== "active") throw new AppError("ADMIN_UNAUTHORISED");
  return seller;
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session) throw new AppError("AUTH_REQUIRED");
    const seller = await getActiveSeller(session.userId);
    const promotions = await listSellerPromotions(seller.id);
    return Response.json({ promotions });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) throw new AppError("AUTH_REQUIRED");

    const ip = getClientIp(req.headers);
    const { allowed } = await rateLimit(`seller:promotions:create:${session.userId}`, 20, 3600);
    if (!allowed) throw new AppError("RATE_LIMIT_EXCEEDED");

    const seller = await getActiveSeller(session.userId);
    const body = await req.json().catch(() => ({}));
    const parsed = createPromotionSchema.safeParse(body);
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", parsed.error.flatten().fieldErrors);

    const promotion = await createPromotion(seller.id, session.userId, parsed.data);
    return Response.json({ promotion }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
