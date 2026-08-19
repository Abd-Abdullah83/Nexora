// app/api/sellers/support/route.ts
// GET  — seller's ticket list (paginated)
// POST — open a new support ticket

import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { rateLimit } from "@/lib/security/rate-limit";
import {
  createSupportTicket,
  getSellerTickets,
} from "@/lib/sellers/support-tickets.service";
import { AppError, errorResponse } from "@/lib/errors";
import { z } from "zod";

const createSchema = z.object({
  subject: z.string().trim().min(5, "Subject must be at least 5 characters.").max(200),
  body: z.string().trim().min(10, "Message must be at least 10 characters.").max(5000),
});

async function getActiveSeller(userId: string) {
  const seller = await prisma.seller.findUnique({
    where: { userId },
    select: { id: true, status: true },
  });
  if (!seller || seller.status !== "active") throw new AppError("ADMIN_UNAUTHORISED");
  return seller;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) throw new AppError("AUTH_REQUIRED");
    const seller = await getActiveSeller(session.userId);

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const pageSize = Math.min(50, parseInt(searchParams.get("pageSize") ?? "20"));

    const result = await getSellerTickets(seller.id, { page, pageSize });
    return Response.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) throw new AppError("AUTH_REQUIRED");

    const { allowed } = await rateLimit(`support:create:${session.userId}`, 5, 3600);
    if (!allowed) throw new AppError("RATE_LIMIT_EXCEEDED");

    const seller = await getActiveSeller(session.userId);

    const body = await req.json().catch(() => ({}));
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", parsed.error.flatten().fieldErrors);

    const ticket = await createSupportTicket({
      sellerId: seller.id,
      sellerUserId: session.userId,
      subject: parsed.data.subject,
      body: parsed.data.body,
    });

    return Response.json({ ticket }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
