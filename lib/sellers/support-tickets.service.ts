// lib/sellers/support-tickets.service.ts
//
// Phase 10 gap fill: Support Center — seller-to-admin tickets.
//
// Deliberately a SEPARATE data model from Phase 10's buyer-seller
// MessageThread. MessageThread requires a non-nullable buyerId + orderId;
// a support ticket is a seller<->Admin conversation with neither of those.
// Rather than loosen an already-shipped working table, this adds a
// dedicated SupportTicket + SupportTicketMessage pair. See the migration
// comment for more context.

import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors";
import { logAuditEvent } from "@/lib/audit";
import { createNotification } from "@/lib/notifications/notifications.service";

// ── Seller actions ────────────────────────────────────────────────────────

export async function createSupportTicket(params: {
  sellerId: string;
  sellerUserId: string;
  subject: string;
  body: string;
}) {
  const ticket = await prisma.$transaction(async (tx) => {
    const t = await tx.supportTicket.create({
      data: {
        sellerId: params.sellerId,
        subject: params.subject,
      },
    });
    await tx.supportTicketMessage.create({
      data: {
        ticketId: t.id,
        senderRole: "seller",
        senderId: params.sellerUserId,
        body: params.body,
      },
    });
    return t;
  });

  await logAuditEvent({
    userId: params.sellerUserId,
    action: "seller.support_ticket_created",
    resourceType: "support_ticket",
    resourceId: ticket.id,
    ipAddress: "internal",
    newValues: { subject: params.subject },
  });

  return ticket;
}

export async function getSellerTickets(sellerId: string, params: { page?: number; pageSize?: number } = {}) {
  const { page = 1, pageSize = 20 } = params;

  const [items, total] = await Promise.all([
    prisma.supportTicket.findMany({
      where: { sellerId },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { body: true, senderRole: true, createdAt: true },
        },
      },
    }),
    prisma.supportTicket.count({ where: { sellerId } }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function getSellerTicket(ticketId: string, sellerId: string) {
  const ticket = await prisma.supportTicket.findFirst({
    where: { id: ticketId, sellerId },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      assignee: { select: { fullName: true } },
    },
  });
  if (!ticket) throw new AppError("VALIDATION_ERROR", { ticket: "Ticket not found." });
  return ticket;
}

export async function sellerReplyToTicket(params: {
  ticketId: string;
  sellerId: string;
  sellerUserId: string;
  body: string;
}) {
  const ticket = await prisma.supportTicket.findFirst({
    where: { id: params.ticketId, sellerId: params.sellerId },
    select: { id: true, status: true },
  });
  if (!ticket) throw new AppError("VALIDATION_ERROR", { ticket: "Ticket not found." });
  if (ticket.status === "closed" || ticket.status === "resolved") {
    throw new AppError("VALIDATION_ERROR", { status: "Cannot reply to a resolved or closed ticket." });
  }

  const [message] = await Promise.all([
    prisma.supportTicketMessage.create({
      data: {
        ticketId: params.ticketId,
        senderRole: "seller",
        senderId: params.sellerUserId,
        body: params.body,
      },
    }),
    // Re-open if it was in_progress after last admin reply
    prisma.supportTicket.update({
      where: { id: params.ticketId },
      data: { status: "open", updatedAt: new Date() },
    }),
  ]);

  return message;
}

// ── Admin actions ─────────────────────────────────────────────────────────

export async function getAdminTicketQueue(params: {
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  const { page = 1, pageSize = 25, status } = params;
  const where = status ? { status: status as any } : {};

  const [items, total] = await Promise.all([
    prisma.supportTicket.findMany({
      where,
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        seller: { select: { displayName: true, businessEmail: true } },
        assignee: { select: { fullName: true } },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { body: true, senderRole: true, createdAt: true },
        },
      },
    }),
    prisma.supportTicket.count({ where }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function adminReplyToTicket(params: {
  ticketId: string;
  adminUserId: string;
  body: string;
}) {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: params.ticketId },
    include: { seller: { select: { userId: true } } },
  });
  if (!ticket) throw new AppError("VALIDATION_ERROR", { ticket: "Ticket not found." });

  const [message] = await Promise.all([
    prisma.supportTicketMessage.create({
      data: {
        ticketId: params.ticketId,
        senderRole: "admin",
        senderId: params.adminUserId,
        body: params.body,
      },
    }),
    prisma.supportTicket.update({
      where: { id: params.ticketId },
      data: { status: "in_progress", updatedAt: new Date() },
    }),
  ]);

  // Notify the seller that admin replied
  if (ticket.seller.userId) {
    await createNotification({
      userId: ticket.seller.userId,
      type: "support_ticket_reply",
      payload: { ticketId: params.ticketId, subject: ticket.subject },
    });
  }

  return message;
}

export async function assignTicket(params: {
  ticketId: string;
  assignToAdminUserId: string;
  actorUserId: string;
}) {
  const ticket = await prisma.supportTicket.update({
    where: { id: params.ticketId },
    data: { assignedTo: params.assignToAdminUserId },
  });

  await logAuditEvent({
    userId: params.actorUserId,
    action: "admin.support_ticket_assigned",
    resourceType: "support_ticket",
    resourceId: params.ticketId,
    ipAddress: "internal",
    newValues: { assignedTo: params.assignToAdminUserId },
  });

  return ticket;
}

export async function resolveTicket(params: {
  ticketId: string;
  adminUserId: string;
}) {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: params.ticketId },
    include: { seller: { select: { userId: true } } },
  });
  if (!ticket) throw new AppError("VALIDATION_ERROR", { ticket: "Ticket not found." });

  const updated = await prisma.supportTicket.update({
    where: { id: params.ticketId },
    data: { status: "resolved", resolvedAt: new Date() },
  });

  await logAuditEvent({
    userId: params.adminUserId,
    action: "admin.support_ticket_resolved",
    resourceType: "support_ticket",
    resourceId: params.ticketId,
    ipAddress: "internal",
  });

  if (ticket.seller.userId) {
    await createNotification({
      userId: ticket.seller.userId,
      type: "support_ticket_reply",
      payload: { ticketId: params.ticketId, subject: ticket.subject, resolved: true },
    });
  }

  return updated;
}
