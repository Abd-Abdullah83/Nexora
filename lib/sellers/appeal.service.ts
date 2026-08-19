// ─────────────────────────────────────────────────────────────────────────
// lib/sellers/appeal.service.ts
//
// Seller Appeal system. A dedicated channel for a banned/suspended seller
// to reach admins and ask for their enforcement action to be reviewed —
// separate from buyer-seller MessageThread (see SCHEMA_ADDITIONS.prisma
// header for why).
//
// LIFECYCLE:
//   banSeller()/suspendSeller() call openAppealOnEnforcement() right after
//   the enforcement action commits. This auto-creates the appeal with a
//   system message containing the reason, status "open", sellerUnread: 1.
//
//   Seller replies  → status "seller_replied", adminUnread++
//   Admin replies   → status "admin_replied",  sellerUnread++
//   Admin resolves:
//     - "uphold" → status "resolved_upheld". Seller stays banned/suspended.
//     - "lift"   → status "resolved_lifted".  reinstateSeller() is called
//                  internally — the appeal resolution IS the reinstatement,
//                  not a separate manual step an admin has to remember.
//
// ACCESS RULE (important): every function here takes a sellerId that the
// caller must have already resolved via requireSeller() — deliberately
// WITHOUT the "status === active" check every other seller route adds.
// That check is exactly what would lock a banned seller out of the one
// feature they need while banned. See the API route files for where this
// is enforced (or rather, deliberately not enforced).
// ─────────────────────────────────────────────────────────────────────────

import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors";
import { logAuditEvent } from "@/lib/audit";
import { reinstateSeller } from "@/lib/sellers/admin-seller.service";
import {
  sendAppealAdminReplyEmail,
  sendAppealResolvedEmail,
} from "@/lib/email/send";

// ── Called from banSeller() / suspendSeller() ─────────────────────────────

export async function openAppealOnEnforcement(params: {
  sellerId: string;
  banRecordId: string;
  action: "banned" | "suspended";
  reason: string;
}) {
  const { sellerId, banRecordId, action, reason } = params;

  const systemMessage =
    action === "banned"
      ? `Your seller account has been permanently banned.\n\nReason: ${reason}\n\nIf you believe this decision was made in error, reply below to explain your side. An admin will review your appeal.`
      : `Your seller account has been suspended.\n\nReason: ${reason}\n\nIf you believe this decision was made in error, reply below to explain your side. An admin will review your appeal.`;

  const appeal = await prisma.sellerAppeal.create({
    data: {
      sellerId,
      banRecordId,
      status: "open",
      sellerUnread: 1,
      messages: {
        create: {
          senderRole: "system",
          senderId: null,
          body: systemMessage,
        },
      },
    },
  });

  return appeal;
}

// ── Seller: view + reply ──────────────────────────────────────────────────

/**
 * Returns the seller's most recent appeal (open or otherwise), with full
 * message history. A seller only ever needs to see their latest one —
 * older resolved appeals are historical, not actionable.
 */
export async function getAppealForSeller(sellerId: string) {
  const appeal = await prisma.sellerAppeal.findFirst({
    where: { sellerId },
    orderBy: { createdAt: "desc" },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!appeal) return null;

  // Mark as read from the seller's side when they open it
  if (appeal.sellerUnread > 0) {
    await prisma.sellerAppeal.update({
      where: { id: appeal.id },
      data: { sellerUnread: 0 },
    });
  }

  return appeal;
}

export async function sellerReplyToAppeal(params: {
  sellerId: string;
  appealId: string;
  body: string;
}) {
  const { sellerId, appealId, body } = params;

  const appeal = await prisma.sellerAppeal.findFirst({
    where: { id: appealId, sellerId },
  });
  if (!appeal) {
    throw new AppError("VALIDATION_ERROR", { appealId: "Appeal not found." });
  }
  if (appeal.status === "resolved_upheld" || appeal.status === "resolved_lifted") {
    throw new AppError("VALIDATION_ERROR", {
      status: "This appeal has already been resolved and is now closed.",
    });
  }

  const [message] = await prisma.$transaction([
    prisma.sellerAppealMessage.create({
      data: { appealId, senderRole: "seller", senderId: sellerId, body },
    }),
    prisma.sellerAppeal.update({
      where: { id: appealId },
      data: {
        status: "seller_replied",
        adminUnread: { increment: 1 },
        sellerUnread: 0,
        updatedAt: new Date(),
      },
    }),
  ]);

  return message;
}

// ── Admin: queue, detail, reply, resolve ──────────────────────────────────

export async function getAppealQueueForAdmin(params: {
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  const { status, page = 1, pageSize = 25 } = params;

  const where =
    status === "open"
      ? { status: { in: ["open", "seller_replied", "admin_replied"] as const } }
      : status
      ? { status: status as any }
      : {};

  const [items, total] = await Promise.all([
    prisma.sellerAppeal.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        seller: {
          select: {
            id: true,
            displayName: true,
            sellerType: true,
            businessEmail: true,
            status: true,
            bannedAt: true,
            banReason: true,
            suspendedUntil: true,
          },
        },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
    prisma.sellerAppeal.count({ where }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function getAppealForAdmin(appealId: string) {
  const appeal = await prisma.sellerAppeal.findUnique({
    where: { id: appealId },
    include: {
      seller: {
        select: {
          id: true,
          displayName: true,
          sellerType: true,
          businessEmail: true,
          status: true,
          bannedAt: true,
          banReason: true,
          suspendedUntil: true,
        },
      },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!appeal) throw new AppError("VALIDATION_ERROR", { id: "Appeal not found." });

  if (appeal.adminUnread > 0) {
    await prisma.sellerAppeal.update({
      where: { id: appealId },
      data: { adminUnread: 0 },
    });
  }

  return appeal;
}

export async function adminReplyToAppeal(params: {
  appealId: string;
  adminUserId: string;
  body: string;
}) {
  const { appealId, adminUserId, body } = params;

  const appeal = await prisma.sellerAppeal.findUnique({
    where: { id: appealId },
    include: { seller: { select: { businessEmail: true, displayName: true } } },
  });
  if (!appeal) throw new AppError("VALIDATION_ERROR", { appealId: "Appeal not found." });
  if (appeal.status === "resolved_upheld" || appeal.status === "resolved_lifted") {
    throw new AppError("VALIDATION_ERROR", {
      status: "This appeal is already resolved. Reopen is not supported — start a fresh review via a new enforcement action if needed.",
    });
  }

  const [message] = await prisma.$transaction([
    prisma.sellerAppealMessage.create({
      data: { appealId, senderRole: "admin", senderId: adminUserId, body },
    }),
    prisma.sellerAppeal.update({
      where: { id: appealId },
      data: {
        status: "admin_replied",
        sellerUnread: { increment: 1 },
        adminUnread: 0,
        updatedAt: new Date(),
      },
    }),
  ]);

  // Email is the reliable channel — same reasoning as ban/suspend emails.
  // A banned seller CAN still receive email even if their session was
  // invalidated, and even if they haven't logged back in yet.
  if (appeal.seller.businessEmail) {
    try {
      await sendAppealAdminReplyEmail({
        to: appeal.seller.businessEmail,
        displayName: appeal.seller.displayName ?? "Seller",
        message: body,
      });
    } catch (err) {
      console.error(`[appeal] Failed to email admin reply for appeal ${appealId}:`, err);
    }
  }

  await logAuditEvent({
    userId: adminUserId,
    action: "admin.appeal_replied",
    resourceType: "seller_appeal",
    resourceId: appealId,
    ipAddress: "internal",
  });

  return message;
}

export async function resolveAppeal(params: {
  appealId: string;
  adminUserId: string;
  outcome: "uphold" | "lift";
  resolutionNote: string;
}) {
  const { appealId, adminUserId, outcome, resolutionNote } = params;

  const appeal = await prisma.sellerAppeal.findUnique({
    where: { id: appealId },
    include: { seller: { select: { id: true, businessEmail: true, displayName: true } } },
  });
  if (!appeal) throw new AppError("VALIDATION_ERROR", { appealId: "Appeal not found." });
  if (appeal.status === "resolved_upheld" || appeal.status === "resolved_lifted") {
    throw new AppError("VALIDATION_ERROR", { status: "This appeal is already resolved." });
  }

  const newStatus = outcome === "lift" ? "resolved_lifted" : "resolved_upheld";

  // If lifting, call the existing reinstateSeller() — this is the ONE
  // place that both resolves the appeal AND undoes the ban/suspension in
  // a single admin action, rather than requiring two separate steps that
  // could be done out of order or forgotten.
  if (outcome === "lift") {
    await reinstateSeller({
      sellerId: appeal.sellerId,
      adminUserId,
      reason: `Appeal approved: ${resolutionNote}`,
    });
  }

  await prisma.$transaction([
    prisma.sellerAppealMessage.create({
      data: {
        appealId,
        senderRole: "admin",
        senderId: adminUserId,
        body:
          outcome === "lift"
            ? `Your appeal has been approved. ${resolutionNote}\n\nYour account has been reinstated.`
            : `Your appeal has been reviewed. ${resolutionNote}\n\nThe original decision stands.`,
      },
    }),
    prisma.sellerAppeal.update({
      where: { id: appealId },
      data: { status: newStatus, sellerUnread: { increment: 1 }, adminUnread: 0 },
    }),
  ]);

  if (appeal.seller.businessEmail) {
    try {
      await sendAppealResolvedEmail({
        to: appeal.seller.businessEmail,
        displayName: appeal.seller.displayName ?? "Seller",
        outcome,
        resolutionNote,
      });
    } catch (err) {
      console.error(`[appeal] Failed to email resolution for appeal ${appealId}:`, err);
    }
  }

  await logAuditEvent({
    userId: adminUserId,
    action: outcome === "lift" ? "admin.appeal_lifted" : "admin.appeal_upheld",
    resourceType: "seller_appeal",
    resourceId: appealId,
    ipAddress: "internal",
    newValues: { resolutionNote },
  });

  return { appealId, status: newStatus };
}
