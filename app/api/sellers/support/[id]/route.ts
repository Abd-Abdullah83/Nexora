// app/api/sellers/support/[id]/route.ts
// GET  — fetch one ticket with all messages (ownership-scoped to seller)
// POST — seller replies to an open ticket

import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { rateLimit } from "@/lib/security/rate-limit";
import { getSellerTicket, sellerReplyToTicket } from "@/lib/sellers/support-tickets.service";
import { AppError, errorResponse } from "@/lib/errors";
import { z } from "zod";

const replySchema = z.object({
  body: z.string().trim().min(2, "Reply must be at least 2 characters.").max(5000),
});

async function getActiveSeller(userId: string) {
  const seller = await prisma.seller.findUnique({
    where: { userId },
    select: { id: true, status: true },
  });
  if (!seller || seller.status !== "active") throw new AppError("ADMIN_UNAUTHORISED");
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
    // getSellerTicket enforces sellerId ownership — returns 404 if not theirs
    const ticket = await getSellerTicket(params.id, seller.id);
    return Response.json({ ticket });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session) throw new AppError("AUTH_REQUIRED");

    const { allowed } = await rateLimit(`support:reply:${session.userId}`, 20, 60);
    if (!allowed) throw new AppError("RATE_LIMIT_EXCEEDED");

    const seller = await getActiveSeller(session.userId);
    const body = await req.json().catch(() => ({}));
    const parsed = replySchema.safeParse(body);
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", parsed.error.flatten().fieldErrors);

    const message = await sellerReplyToTicket({
      ticketId: params.id,
      sellerId: seller.id,
      sellerUserId: session.userId,
      body: parsed.data.body,
    });

    return Response.json({ message }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
