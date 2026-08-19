// app/api/sellers/messages/route.ts
import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { rateLimit, getClientIp } from "@/lib/security/rate-limit";
import { buyerSendMessage, getSellerInbox } from "@/lib/sellers/messaging.service";
import { sendMessageSchema } from "@/lib/validation/message";
import { AppError, errorResponse } from "@/lib/errors";

async function getActiveSeller(userId: string) {
  const seller = await prisma.seller.findUnique({ where: { userId }, select: { id: true, status: true } });
  if (!seller || seller.status !== "active") return null;
  return seller;
}

// GET — seller views their inbox
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) throw new AppError("AUTH_REQUIRED");
    const seller = await getActiveSeller(session.userId);
    if (!seller) throw new AppError("ADMIN_UNAUTHORISED");

    const page = Number(req.nextUrl.searchParams.get("page") ?? "1");
    const data = await getSellerInbox(seller.id, { page, pageSize: 20 });
    return Response.json(data);
  } catch (error) {
    return errorResponse(error);
  }
}

// POST — buyer sends a message to a seller
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) throw new AppError("AUTH_REQUIRED");

    const ip = getClientIp(req.headers);
    const { allowed } = await rateLimit(`msg:send:${session.userId}`, 30, 3600);
    if (!allowed) throw new AppError("RATE_LIMIT_EXCEEDED");

    const body = await req.json().catch(() => ({}));
    const parsed = sendMessageSchema.safeParse(body);
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", parsed.error.flatten().fieldErrors);

    const result = await buyerSendMessage({
      buyerId: session.userId,
      sellerId: parsed.data.sellerId,
      orderId: parsed.data.orderId,
      body: parsed.data.body,
    });

    return Response.json(result, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
