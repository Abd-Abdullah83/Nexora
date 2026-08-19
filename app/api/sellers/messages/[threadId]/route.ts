// app/api/sellers/messages/[threadId]/route.ts
//
// Phase 10 — GET messages in a thread + POST a reply.
// Accessible by both the seller (owner of the thread) and the buyer
// (who started it). Role is derived from the session — no explicit
// role param needed.

import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { rateLimit, getClientIp } from "@/lib/security/rate-limit";
import { AppError, errorResponse } from "@/lib/errors";
import { z } from "zod";

const replySchema = z.object({
  body: z.string().min(1).max(2000).trim(),
});

// ── GET /api/sellers/messages/[threadId] ──────────────────────────────────
// Returns all messages in the thread. Caller must be the buyer or seller.
export async function GET(
  _req: NextRequest,
  { params }: { params: { threadId: string } }
) {
  try {
    const session = await getSession();
    if (!session) throw new AppError("AUTH_REQUIRED");

    const thread = await prisma.messageThread.findUnique({
      where: { id: params.threadId },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            senderRole: true,
            senderId: true,
            body: true,
            createdAt: true,
          },
        },
        buyer: { select: { fullName: true, avatarUrl: true } },
        seller: {
          include: {
            store: { select: { name: true, logoUrl: true } },
          },
        },
        order: { select: { orderNumber: true } },
      },
    });

    if (!thread) throw new AppError("PRODUCT_NOT_FOUND", { thread: "Thread not found." });

    // Ownership check — must be the buyer OR the seller
    const isBuyer = thread.buyerId === session.userId;
    const isSeller = thread.seller.userId === session.userId;
    if (!isBuyer && !isSeller) {
      throw new AppError("PRODUCT_NOT_FOUND", { thread: "Thread not found." });
    }

    // Mark as read for this viewer
    // Only sellerUnread is tracked in the schema; no buyerUnread column exists.
    if (isSeller) {
      await prisma.messageThread.update({
        where: { id: params.threadId },
        data: { sellerUnread: 0 },
      });
    }

    return Response.json({
      thread: {
        id: thread.id,
        orderId: thread.orderId,
        orderNumber: thread.order.orderNumber,
        buyerName: thread.buyer.fullName,
        storeName: thread.seller.store?.name ?? "Seller",
        messages: thread.messages,
        viewerRole: isBuyer ? "buyer" : "seller",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

// ── POST /api/sellers/messages/[threadId] ─────────────────────────────────
// Sends a reply. Accessible by both buyer and seller in the thread.
export async function POST(
  req: NextRequest,
  { params }: { params: { threadId: string } }
) {
  const ip = getClientIp(req.headers);
  try {
    const session = await getSession();
    if (!session) throw new AppError("AUTH_REQUIRED");

    const { allowed } = await rateLimit(`msg:reply:${session.userId}`, 30, 3600);
    if (!allowed) throw new AppError("RATE_LIMIT_EXCEEDED");

    const body = await req.json().catch(() => ({}));
    const parsed = replySchema.safeParse(body);
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", parsed.error.flatten().fieldErrors);

    const thread = await prisma.messageThread.findUnique({
      where: { id: params.threadId },
      include: { seller: { select: { userId: true } } },
    });

    if (!thread) throw new AppError("PRODUCT_NOT_FOUND", { thread: "Thread not found." });

    const isBuyer = thread.buyerId === session.userId;
    const isSeller = thread.seller.userId === session.userId;
    if (!isBuyer && !isSeller) {
      throw new AppError("PRODUCT_NOT_FOUND", { thread: "Thread not found." });
    }

    const senderRole = isBuyer ? "buyer" : "seller";

    const [message] = await prisma.$transaction([
      prisma.message.create({
        data: {
          threadId: thread.id,
          senderRole,
          senderId: session.userId,
          body: parsed.data.body,
        },
      }),
      prisma.messageThread.update({
        where: { id: thread.id },
        data: {
          updatedAt: new Date(),
          // Increment unread count for the seller when buyer sends a message.
          // No buyerUnread column exists in the schema, so seller replies
          // don't track unread on the buyer side.
          ...(isBuyer ? { sellerUnread: { increment: 1 } } : {}),
        },
      }),
    ]);

    return Response.json({ message }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
