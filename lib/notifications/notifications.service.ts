// lib/notifications/notifications.service.ts
//
// Phase 10 gap fill: "notification feed for order/dispute/payout events."
// Deliberately minimal — creation + list + mark-read. No push/email/SMS
// delivery here (that's a separate, larger integration); this is the
// in-app bell feed only, matching what the spec's UI section asked for
// ("Notifications bell").

import { prisma } from "@/lib/db/prisma";
import type { NotificationType } from "@prisma/client";

export async function createNotification(params: {
  userId: string;
  type: NotificationType;
  payload: Record<string, unknown>;
}) {
  return prisma.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      payload: params.payload as any,
    },
  });
}

export async function getNotificationsForUser(
  userId: string,
  params: { page?: number; pageSize?: number; unreadOnly?: boolean } = {}
) {
  const { page = 1, pageSize = 20, unreadOnly = false } = params;

  const where = {
    userId,
    ...(unreadOnly ? { readAt: null } : {}),
  };

  const [items, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);

  return { items, total, unreadCount, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function markNotificationRead(notificationId: string, userId: string) {
  // Scoped by userId in the WHERE clause itself, not just checked
  // beforehand — same defense-in-depth pattern used everywhere else in
  // this codebase. updateMany rather than update so a mismatched
  // ownership silently affects zero rows instead of throwing.
  const result = await prisma.notification.updateMany({
    where: { id: notificationId, userId, readAt: null },
    data: { readAt: new Date() },
  });
  return result.count > 0;
}

export async function markAllNotificationsRead(userId: string) {
  await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
}
