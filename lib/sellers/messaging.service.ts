// lib/sellers/messaging.service.ts
//
// Phase 10 — Buyer-to-seller messaging, one thread per (buyer, seller, order).

import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors";

// ── Buyer actions ─────────────────────────────────────────────────────────

/**
 * Creates a thread (or finds the existing one) and posts the buyer's
 * first message. findOrCreate pattern means the buyer can always
 * click "Message Seller" without worrying about duplicates.
 */
export async function buyerSendMessage(params: {
  buyerId: string;
  sellerId: string;
  orderId: string;
  body: string;
}) {
  const { buyerId, sellerId, orderId, body } = params;

  // Verify the order belongs to this buyer and contains the seller's items
  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      userId: buyerId,
      items: { some: { sellerId } },
    },
    select: { id: true },
  });
  if (!order) {
    throw new AppError("VALIDATION_ERROR", {
      orderId: "Order not found or this seller is not associated with it.",
    });
  }

  const thread = await prisma.messageThread.upsert({
    where: {
      buyerId_sellerId_orderId: { buyerId, sellerId, orderId },
    },
    create: {
      buyerId,
      sellerId,
      orderId,
      sellerUnread: 1,
    },
    update: {
      sellerUnread: { increment: 1 },
      updatedAt: new Date(),
    },
  });

  const message = await prisma.message.create({
    data: {
      threadId: thread.id,
      senderRole: "buyer",
      senderId: buyerId,
      body,
    },
  });

  return { thread, message };
}

// ── Seller actions ────────────────────────────────────────────────────────

/**
 * Returns all threads for a seller, with latest message preview.
 * Marks threads as read when seller opens the inbox.
 */
export async function getSellerInbox(
  sellerId: string,
  params: { page?: number; pageSize?: number } = {}
) {
  const { page = 1, pageSize = 20 } = params;

  const [threads, total] = await Promise.all([
    prisma.messageThread.findMany({
      where: { sellerId },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        buyer: { select: { id: true, fullName: true, avatarUrl: true } },
        order: { select: { id: true, orderNumber: true } },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { body: true, senderRole: true, createdAt: true },
        },
      },
    }),
    prisma.messageThread.count({ where: { sellerId } }),
  ]);

  return {
    threads,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
    totalUnread: threads.reduce((s, t) => s + t.sellerUnread, 0),
  };
}

export async function getThread(threadId: string, sellerId: string) {
  const thread = await prisma.messageThread.findFirst({
    where: { id: threadId, sellerId },
    include: {
      buyer: { select: { id: true, fullName: true, avatarUrl: true } },
      order: { select: { id: true, orderNumber: true } },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!thread) return null;

  // Mark as read when seller opens the thread
  if (thread.sellerUnread > 0) {
    await prisma.messageThread.update({
      where: { id: threadId },
      data: { sellerUnread: 0 },
    });
  }

  return thread;
}

export async function sellerReply(params: {
  threadId: string;
  sellerId: string;
  body: string;
}) {
  const { threadId, sellerId, body } = params;

  const thread = await prisma.messageThread.findFirst({
    where: { id: threadId, sellerId },
    select: { id: true, sellerId: true },
  });
  if (!thread) {
    throw new AppError("VALIDATION_ERROR", { thread: "Thread not found." });
  }

  const [message] = await Promise.all([
    prisma.message.create({
      data: {
        threadId,
        senderRole: "seller",
        senderId: sellerId,
        body,
      },
    }),
    prisma.messageThread.update({
      where: { id: threadId },
      data: { updatedAt: new Date() },
    }),
  ]);

  return message;
}

/** Unread count for the sidebar badge — lightweight, called on every nav render. */
export async function getSellerUnreadCount(sellerId: string): Promise<number> {
  const result = await prisma.messageThread.aggregate({
    where: { sellerId },
    _sum: { sellerUnread: true },
  });
  return result._sum.sellerUnread ?? 0;
}
