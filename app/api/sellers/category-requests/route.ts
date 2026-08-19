import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import {
  createCategoryRequest,
  getCategoryRequestsForSeller,
} from "@/lib/sellers/category-request.service";
import { createCategoryRequestSchema } from "@/lib/validation/category-request";
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

// ── GET /api/sellers/category-requests ────────────────────────────────────
export async function GET() {
  try {
    const session = await getSession();
    if (!session) throw new AppError("AUTH_REQUIRED");
    const seller = await getActiveSeller(session.userId);

    const requests = await getCategoryRequestsForSeller(seller.id);
    return Response.json({ requests });
  } catch (error) {
    return errorResponse(error);
  }
}

// ── POST /api/sellers/category-requests ───────────────────────────────────
export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  try {
    const session = await getSession();
    if (!session) throw new AppError("AUTH_REQUIRED");

    const { allowed } = await rateLimit(`category-request:${session.userId}`, 10, 60);
    if (!allowed) throw new AppError("RATE_LIMIT_EXCEEDED");

    const seller = await getActiveSeller(session.userId);

    const body = await req.json();
    const parsed = createCategoryRequestSchema.safeParse(body);
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", parsed.error.flatten());

    const request = await createCategoryRequest(seller.id, session.userId, parsed.data);
    return Response.json({ request }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
