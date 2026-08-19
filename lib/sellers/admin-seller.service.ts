// ─────────────────────────────────────────────────────────────────────────
// lib/sellers/admin-seller.service.ts
//
// UPDATE (this delivery): banSeller() and suspendSeller() now also call
// openAppealOnEnforcement() right after the ban record is created, so the
// seller gets both an email (previous fix) AND an in-app appeal thread
// they can reply to directly, without needing to email support back.
//
// Everything else in this file (ban/suspend/reinstate logic, side-effects,
// email sending) is unchanged from the previous delivery.
// ─────────────────────────────────────────────────────────────────────────

import { prisma } from "@/lib/db/prisma";
import { redis } from "@/lib/db/redis";
import { AppError } from "@/lib/errors";
import { logAuditEvent } from "@/lib/audit";
import { sendSellerBannedEmail, sendSellerSuspendedEmail } from "@/lib/email/send";
import { openAppealOnEnforcement } from "@/lib/sellers/appeal.service";

// ── Internal helpers ──────────────────────────────────────────────────────

async function getSellerOrThrow(sellerId: string) {
  const seller = await prisma.seller.findUnique({
    where: { id: sellerId },
    select: {
      id: true,
      userId: true,
      status: true,
      isSystemSeller: true,
      displayName: true,
      businessEmail: true,
    },
  });
  if (!seller) throw new AppError("VALIDATION_ERROR", { id: "Seller not found." });
  if (seller.isSystemSeller) {
    throw new AppError("VALIDATION_ERROR", {
      id: "The platform system seller cannot be banned or suspended.",
    });
  }
  return seller;
}

// ── Ban ───────────────────────────────────────────────────────────────────

export async function banSeller(params: {
  sellerId: string;
  adminUserId: string;
  reason: string;
  triggeredByHashIds?: string[];
}) {
  const { sellerId, adminUserId, reason, triggeredByHashIds = [] } = params;
  const seller = await getSellerOrThrow(sellerId);

  if (seller.status === "banned") {
    throw new AppError("VALIDATION_ERROR", { status: "Seller is already banned." });
  }

  const now = new Date();

  // Capture the ban record's id — created inside the transaction, needed
  // afterward to link the appeal thread to this specific enforcement event.
  let banRecordId: string;

  await prisma.$transaction(async (tx) => {
    await tx.seller.update({
      where: { id: sellerId },
      data: {
        status: "banned",
        bannedAt: now,
        bannedBy: adminUserId,
        banReason: reason,
        suspendedUntil: null,
      },
    });

    await tx.product.updateMany({
      where: { sellerId, status: { in: ["active", "draft"] }, deletedAt: null },
      data: { status: "archived" },
    });

    await tx.payoutRequest.updateMany({
      where: { sellerId, status: { in: ["requested", "processing"] } },
      data: {
        status: "cancelled",
        processedBy: adminUserId,
        processedAt: now,
        adminNote: `Auto-cancelled: seller banned. Reason: ${reason}`,
      },
    });

    await tx.escrowHold.updateMany({
      where: { sellerId, status: "held" },
      data: { status: "frozen" },
    });

    const banRecord = await tx.sellerBanRecord.create({
      data: {
        sellerId,
        action: "banned",
        reason,
        adminId: adminUserId,
        triggeredByHashIds,
      },
    });
    banRecordId = banRecord.id;
  });

  try {
    await redis.del(`session:${seller.userId}`);
  } catch {
    // Non-fatal.
  }

  if (seller.businessEmail) {
    try {
      await sendSellerBannedEmail({
        to: seller.businessEmail,
        displayName: seller.displayName ?? "Seller",
        reason,
      });
    } catch (emailErr) {
      console.error(`[admin-seller] Failed to send ban email to seller ${sellerId}:`, emailErr);
    }
  }

  // NEW: auto-open the appeal thread with a system message containing the
  // reason. This is what lets the seller "receive a message in inbox" and
  // reply back to admins — separate from the email, which they may not
  // check, or may go to spam.
  try {
    await openAppealOnEnforcement({
      sellerId,
      banRecordId: banRecordId!,
      action: "banned",
      reason,
    });
  } catch (appealErr) {
    console.error(`[admin-seller] Failed to open appeal thread for seller ${sellerId}:`, appealErr);
    // Non-fatal — the ban itself already succeeded and the email was sent.
    // Worst case, the seller has to reach support another way; this
    // should not roll back an already-committed enforcement action.
  }

  await logAuditEvent({
    userId: adminUserId,
    action: "admin.seller_banned",
    resourceType: "seller",
    resourceId: sellerId,
    ipAddress: "internal",
    newValues: { reason, triggeredByHashIds },
  });

  return { sellerId, status: "banned", bannedAt: new Date() };
}

// ── Suspend ───────────────────────────────────────────────────────────────

export async function suspendSeller(params: {
  sellerId: string;
  adminUserId: string;
  reason: string;
  suspendedUntil?: Date;
}) {
  const { sellerId, adminUserId, reason, suspendedUntil } = params;
  const seller = await getSellerOrThrow(sellerId);

  if (seller.status === "banned") {
    throw new AppError("VALIDATION_ERROR", {
      status: "Cannot suspend a banned seller. Use reinstate first if needed.",
    });
  }
  if (seller.status === "suspended") {
    throw new AppError("VALIDATION_ERROR", { status: "Seller is already suspended." });
  }
  if (seller.status !== "active") {
    throw new AppError("VALIDATION_ERROR", {
      status: `Only active sellers can be suspended — current status is "${seller.status}".`,
    });
  }

  let banRecordId: string;

  await prisma.$transaction(async (tx) => {
    await tx.seller.update({
      where: { id: sellerId },
      data: {
        status: "suspended",
        suspendedUntil: suspendedUntil ?? null,
      },
    });

    const banRecord = await tx.sellerBanRecord.create({
      data: {
        sellerId,
        action: "suspended",
        reason,
        adminId: adminUserId,
        suspendedUntil: suspendedUntil ?? null,
      },
    });
    banRecordId = banRecord.id;
  });

  try {
    await redis.del(`session:${seller.userId}`);
  } catch {}

  if (seller.businessEmail) {
    try {
      await sendSellerSuspendedEmail({
        to: seller.businessEmail,
        displayName: seller.displayName ?? "Seller",
        reason,
        suspendedUntil: suspendedUntil ?? null,
      });
    } catch (emailErr) {
      console.error(`[admin-seller] Failed to send suspension email to seller ${sellerId}:`, emailErr);
    }
  }

  // NEW: same appeal auto-open as banSeller()
  try {
    await openAppealOnEnforcement({
      sellerId,
      banRecordId: banRecordId!,
      action: "suspended",
      reason,
    });
  } catch (appealErr) {
    console.error(`[admin-seller] Failed to open appeal thread for seller ${sellerId}:`, appealErr);
  }

  await logAuditEvent({
    userId: adminUserId,
    action: "admin.seller_suspended",
    resourceType: "seller",
    resourceId: sellerId,
    ipAddress: "internal",
    newValues: { reason, suspendedUntil: suspendedUntil?.toISOString() ?? "indefinite" },
  });

  return { sellerId, status: "suspended", suspendedUntil };
}

// ── Reinstate ─────────────────────────────────────────────────────────────
//
// Called directly for a manual admin reinstate, AND internally by
// resolveAppeal() in appeal.service.ts when an admin picks "lift" as the
// appeal outcome — same function, two entry points, one source of truth
// for what "reinstated" means.

export async function reinstateSeller(params: {
  sellerId: string;
  adminUserId: string;
  reason: string;
}) {
  const { sellerId, adminUserId, reason } = params;
  const seller = await getSellerOrThrow(sellerId);

  if (!["banned", "suspended"].includes(seller.status)) {
    throw new AppError("VALIDATION_ERROR", {
      status: `Only banned or suspended sellers can be reinstated — current status is "${seller.status}".`,
    });
  }

  await prisma.$transaction(async (tx) => {
    await tx.seller.update({
      where: { id: sellerId },
      data: {
        status: "active",
        bannedAt: null,
        bannedBy: null,
        banReason: null,
        suspendedUntil: null,
      },
    });

    if (seller.status === "banned") {
      await tx.escrowHold.updateMany({
        where: { sellerId, status: "frozen" },
        data: { status: "held" },
      });
    }

    await tx.sellerBanRecord.create({
      data: {
        sellerId,
        action: "reinstated",
        reason,
        adminId: adminUserId,
      },
    });
  });

  await logAuditEvent({
    userId: adminUserId,
    action: "admin.seller_reinstated",
    resourceType: "seller",
    resourceId: sellerId,
    ipAddress: "internal",
    newValues: { reason, previousStatus: seller.status },
  });

  return { sellerId, status: "active" };
}

// ── List sellers (admin) ──────────────────────────────────────────────────

export interface SellerListFilters {
  status?: string;
  sellerType?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export async function listSellersForAdmin(filters: SellerListFilters = {}) {
  const { status, sellerType, search, page = 1, pageSize = 25 } = filters;

  const where: any = {
    isSystemSeller: false,
    ...(status ? { status: status as any } : {}),
    ...(sellerType ? { sellerType: sellerType as any } : {}),
    ...(search
      ? {
          OR: [
            { displayName: { contains: search, mode: "insensitive" } },
            { businessEmail: { contains: search, mode: "insensitive" } },
            { user: { email: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [sellers, total] = await Promise.all([
    prisma.seller.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        displayName: true,
        sellerType: true,
        status: true,
        businessEmail: true,
        bannedAt: true,
        banReason: true,
        suspendedUntil: true,
        createdAt: true,
        user: { select: { email: true, fullName: true } },
        store: { select: { name: true, slug: true, avgRating: true, reviewCount: true } },
        _count: {
          select: {
            products: true,
            orderItems: true,
            payoutRequests: true,
            banEvasionAlerts: true,
          },
        },
      },
    }),
    prisma.seller.count({ where }),
  ]);

  return { sellers, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

// ── Get single seller detail (admin) ─────────────────────────────────────

export async function getSellerDetailForAdmin(sellerId: string) {
  const seller = await prisma.seller.findUnique({
    where: { id: sellerId },
    include: {
      user: { select: { email: true, fullName: true, createdAt: true } },
      store: true,
      subscription: true,
      verifications: { orderBy: { createdAt: "desc" } },
      identityHashes: { select: { identityType: true, createdAt: true } },
      banRecords: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { admin: { select: { fullName: true, email: true } } },
      },
      banEvasionAlerts: {
        where: { status: "pending" },
        select: { id: true, matchedSellerId: true, matchedIdentityType: true, createdAt: true },
      },
      wallet: { select: { availableBalance: true, pendingBalance: true, currency: true } },
      _count: {
        select: { products: true, orderItems: true, payoutRequests: true },
      },
    },
  });

  if (!seller) throw new AppError("VALIDATION_ERROR", { id: "Seller not found." });

  return seller;
}

// ── Two-admin ban request flow ─────────────────────────────────────────────

/**
 * Step 1: An admin requests a ban. Creates a pending SellerBanRequest.
 * The seller is NOT banned yet — a second admin must call confirmSellerBan().
 */
export async function requestSellerBan(params: {
  sellerId: string;
  adminUserId: string;
  reason: string;
}) {
  const { sellerId, adminUserId, reason } = params;
  await getSellerOrThrow(sellerId);

  // Check there is no already-pending request
  const existing = await prisma.sellerBanRequest.findFirst({
    where: { sellerId, status: "pending" },
  });
  if (existing) {
    throw new AppError("VALIDATION_ERROR", {
      sellerId: "A pending ban request already exists for this seller.",
    });
  }

  const request = await prisma.sellerBanRequest.create({
    data: { sellerId, requestedBy: adminUserId, reason, status: "pending" },
  });

  await logAuditEvent({
    userId: adminUserId,
    action: "admin.seller_ban_requested",
    resourceType: "seller",
    resourceId: sellerId,
    ipAddress: "internal",
    newValues: { reason },
  });

  return request;
}

/**
 * Step 2: A DIFFERENT admin confirms the pending ban request.
 * This executes the actual ban via the existing banSeller() function.
 */
export async function confirmSellerBan(params: {
  sellerId: string;
  confirmingAdminUserId: string;
}) {
  const { sellerId, confirmingAdminUserId } = params;

  const request = await prisma.sellerBanRequest.findFirst({
    where: { sellerId, status: "pending" },
  });
  if (!request) {
    throw new AppError("VALIDATION_ERROR", {
      sellerId: "No pending ban request found for this seller.",
    });
  }
  if (request.requestedBy === confirmingAdminUserId) {
    throw new AppError("VALIDATION_ERROR", {
      adminId: "The confirming admin must be different from the requesting admin.",
    });
  }

  // Mark request as confirmed
  await prisma.sellerBanRequest.update({
    where: { id: request.id },
    data: { status: "confirmed", confirmedBy: confirmingAdminUserId, confirmedAt: new Date() },
  });

  // Execute the actual ban
  const result = await banSeller({
    sellerId,
    adminUserId: confirmingAdminUserId,
    reason: request.reason,
  });

  return result;
}

/**
 * Either admin can cancel a pending ban request — no irreversible action taken.
 */
export async function cancelBanRequest(params: {
  sellerId: string;
  adminUserId: string;
}) {
  const { sellerId, adminUserId } = params;

  const request = await prisma.sellerBanRequest.findFirst({
    where: { sellerId, status: "pending" },
  });
  if (!request) {
    throw new AppError("VALIDATION_ERROR", {
      sellerId: "No pending ban request found for this seller.",
    });
  }

  await prisma.sellerBanRequest.update({
    where: { id: request.id },
    data: { status: "cancelled", cancelledBy: adminUserId, cancelledAt: new Date() },
  });

  await logAuditEvent({
    userId: adminUserId,
    action: "admin.seller_ban_request_cancelled",
    resourceType: "seller",
    resourceId: sellerId,
    ipAddress: "internal",
    newValues: {},
  });

  return { sellerId, status: "ban_request_cancelled" };
}
