import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getStoreForSeller, updateStore } from "@/lib/sellers/store.service";
import { storeUpsertSchema } from "@/lib/validation/seller-store";
import { getClientIp, rateLimit } from "@/lib/security/rate-limit";
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

export async function GET(_req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) throw new AppError("AUTH_REQUIRED");
    const seller = await getActiveSeller(session.userId);
    const store = await getStoreForSeller(seller.id);
    if (!store) throw new AppError("VALIDATION_ERROR", { store: "Store not found." });
    return Response.json({ store });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(req: NextRequest) {
  const ip = getClientIp(req.headers);
  try {
    const session = await getSession();
    if (!session) throw new AppError("AUTH_REQUIRED");

    const { allowed } = await rateLimit(`store-update:${session.userId}`, 20, 60);
    if (!allowed) throw new AppError("RATE_LIMIT_EXCEEDED");

    const seller = await getActiveSeller(session.userId);
    const body = await req.json();
    const parsed = storeUpsertSchema.safeParse(body);
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", parsed.error.flatten());

    const store = await updateStore(seller.id, parsed.data);
    return Response.json({ store });
  } catch (error) {
    return errorResponse(error);
  }
}
