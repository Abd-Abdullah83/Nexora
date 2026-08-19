// app/api/sellers/messages/unread/route.ts
// Phase 10 — lightweight unread-count endpoint called by SellerLayout on
// mount to drive the Messages badge. Kept separate from the main messages
// route so the sidebar can call it cheaply (no pagination, no message bodies).

import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getSellerUnreadCount } from "@/lib/sellers/messaging.service";
import { AppError, errorResponse } from "@/lib/errors";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) throw new AppError("AUTH_REQUIRED");

    const seller = await prisma.seller.findUnique({
      where: { userId: session.userId },
      select: { id: true, status: true },
    });
    if (!seller || seller.status !== "active") {
      return Response.json({ unread: 0 });
    }

    const unread = await getSellerUnreadCount(seller.id);
    return Response.json({ unread });
  } catch (error) {
    return errorResponse(error);
  }
}
