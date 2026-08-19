// lib/admin/product-enforcement.service.ts
//
// Admin enforcement on individual seller-owned listings — distinct from
// account-level seller bans (admin-seller.service.ts). A seller can have
// many listings; admin needs to act on one bad listing without touching
// the seller's account or their other listings.
//
// ── Suspend vs Ban ────────────────────────────────────────────────────────
// Suspend: reversible, ONE admin can do it unilaterally. Listing goes
//   invisible (status: admin_suspended) but nothing else about it changes.
//   Reinstate returns it to "active".
// Ban: permanent, requires a SECOND, different admin to confirm before it
//   executes — same two-admin pattern as lib/sellers/admin-seller.service.ts's
//   seller-level ban, for the same reason (irreversibility).
//
// ── Structural enforcement of the two-admin rule ──────────────────────────
// banProduct() below is NOT exported. It is only ever called from
// confirmProductBan() in this same file, after the different-admin check
// has passed. No route can import banProduct() directly and bypass the
// two-admin gate, because there is nothing to import.
//
// ── Seller notification ───────────────────────────────────────────────────
// Both suspend and ban notify the seller with the admin's stated reason —
// required by the acceptance criteria for this feature. Uses the existing
// createNotification() from lib/notifications/notifications.service.ts.

import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors";
import { logAuditEvent } from "@/lib/audit";
import { createNotification } from "@/lib/notifications/notifications.service";

// ── Internal helper ────────────────────────────────────────────────────────

async function getEnforceableProductOrThrow(productId: string) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      name: true,
      status: true,
      sellerId: true,
      seller: { select: { userId: true, isSystemSeller: true } },
    },
  });
  if (!product) throw new AppError("PRODUCT_NOT_FOUND");

  // Enforcement actions only make sense for real, independent-seller
  // listings — mirrors the exact same isSystemSeller check used in the
  // admin PUT-blocking fix, applied here for the opposite direction: a
  // platform-owned product can't be "suspended/banned", it's just edited
  // or archived directly by admin like normal.
  if (!product.sellerId || product.seller?.isSystemSeller) {
    throw new AppError("VALIDATION_ERROR", {
      productId: "This is a platform-owned product — use normal edit/archive, not seller enforcement actions.",
    });
  }

  return product;
}

// ── Suspend (single admin, reversible) ────────────────────────────────────

export async function suspendProduct(params: {
  productId: string;
  adminUserId: string;
  reason: string;
}) {
  const product = await getEnforceableProductOrThrow(params.productId);

  if (product.status === "admin_suspended") {
    throw new AppError("VALIDATION_ERROR", { status: "Listing is already suspended." });
  }
  if (product.status === "admin_banned") {
    throw new AppError("VALIDATION_ERROR", {
      status: "Listing is banned, not suspended. Reinstate is not available for banned listings.",
    });
  }

  const now = new Date();

  await prisma.product.update({
    where: { id: params.productId },
    data: {
      status: "admin_suspended",
      suspendedAt: now,
      suspendedBy: params.adminUserId,
      suspensionReason: params.reason,
    },
  });

  await logAuditEvent({
    userId: params.adminUserId,
    action: "admin.listing_suspended",
    resourceType: "product",
    resourceId: params.productId,
    ipAddress: "internal",
    newValues: { reason: params.reason },
  });

  if (product.seller?.userId) {
    await createNotification({
      userId: product.seller.userId,
      type: "listing_suspended",
      payload: { productId: params.productId, productName: product.name, reason: params.reason },
    });
  }

  return { productId: params.productId, status: "admin_suspended" as const };
}

// ── Reinstate a suspended listing ─────────────────────────────────────────
// Only for suspensions — a banned listing cannot be reinstated this way
// (there's no "unban" path here by design; it mirrors the seller-level
// pattern where reinstating a ban is a distinct, exceptional admin action,
// not the mirror image of a routine reinstate).

export async function reinstateProduct(params: {
  productId: string;
  adminUserId: string;
  reason: string;
}) {
  const product = await getEnforceableProductOrThrow(params.productId);

  if (product.status !== "admin_suspended") {
    throw new AppError("VALIDATION_ERROR", {
      status: `Only suspended listings can be reinstated this way — current status is "${product.status}".`,
    });
  }

  await prisma.product.update({
    where: { id: params.productId },
    data: {
      status: "active",
      suspendedAt: null,
      suspendedBy: null,
      suspensionReason: null,
    },
  });

  await logAuditEvent({
    userId: params.adminUserId,
    action: "admin.listing_reinstated",
    resourceType: "product",
    resourceId: params.productId,
    ipAddress: "internal",
    newValues: { reason: params.reason },
  });

  if (product.seller?.userId) {
    await createNotification({
      userId: product.seller.userId,
      type: "listing_suspended", // reuse the same notification type — payload distinguishes the outcome
      payload: { productId: params.productId, productName: product.name, outcome: "reinstated", reason: params.reason },
    });
  }

  return { productId: params.productId, status: "active" as const };
}

// ── Ban (INTERNAL — not exported) ─────────────────────────────────────────
// Only ever called from confirmProductBan() below.

async function banProduct(params: {
  productId: string;
  adminUserId: string; // confirming admin — executes it
  requestedBy: string; // original requesting admin — audit trail only
  reason: string;
}) {
  const product = await getEnforceableProductOrThrow(params.productId);

  if (product.status === "admin_banned") {
    throw new AppError("VALIDATION_ERROR", { status: "Listing is already banned." });
  }

  const now = new Date();

  await prisma.product.update({
    where: { id: params.productId },
    data: {
      status: "admin_banned",
      bannedAt: now,
      bannedBy: params.adminUserId,
      banReason: params.reason,
      // Clear any prior suspension bookkeeping — ban supersedes it
      suspendedAt: null,
      suspendedBy: null,
      suspensionReason: null,
    },
  });

  await logAuditEvent({
    userId: params.adminUserId,
    action: "admin.listing_banned",
    resourceType: "product",
    resourceId: params.productId,
    ipAddress: "internal",
    newValues: { reason: params.reason, requestedBy: params.requestedBy, confirmedBy: params.adminUserId },
  });

  if (product.seller?.userId) {
    await createNotification({
      userId: product.seller.userId,
      type: "listing_banned",
      payload: { productId: params.productId, productName: product.name, reason: params.reason },
    });
  }

  return { productId: params.productId, status: "admin_banned" as const };
}

// ── Ban request (step 1 of 2) ──────────────────────────────────────────────

export async function requestProductBan(params: {
  productId: string;
  adminUserId: string;
  reason: string;
}) {
  const product = await getEnforceableProductOrThrow(params.productId);

  if (product.status === "admin_banned") {
    throw new AppError("VALIDATION_ERROR", { status: "Listing is already banned." });
  }

  const existingPending = await prisma.productBanRequest.findFirst({
    where: { productId: params.productId, status: "pending" },
  });
  if (existingPending) {
    throw new AppError("VALIDATION_ERROR", {
      status: "A ban request is already pending for this listing. Confirm or cancel it first.",
    });
  }

  const request = await prisma.productBanRequest.create({
    data: { productId: params.productId, reason: params.reason, requestedBy: params.adminUserId },
    include: { requester: { select: { fullName: true, email: true } } },
  });

  await logAuditEvent({
    userId: params.adminUserId,
    action: "admin.listing_ban_requested",
    resourceType: "product",
    resourceId: params.productId,
    ipAddress: "internal",
    newValues: { reason: params.reason, requestId: request.id },
  });

  return request;
}

// ── Confirm ban request (step 2 of 2 — MUST be a different admin) ────────

export async function confirmProductBan(params: {
  productId: string;
  confirmingAdminUserId: string;
}) {
  const request = await prisma.productBanRequest.findFirst({
    where: { productId: params.productId, status: "pending" },
  });
  if (!request) {
    throw new AppError("VALIDATION_ERROR", { productId: "No pending ban request found for this listing." });
  }

  // ── THE ACTUAL TWO-ADMIN ENFORCEMENT ────────────────────────────────────
  if (request.requestedBy === params.confirmingAdminUserId) {
    throw new AppError("VALIDATION_ERROR", {
      confirmingAdminUserId:
        "A different admin must confirm this ban — the admin who requested it cannot also confirm it.",
    });
  }

  await prisma.productBanRequest.update({
    where: { id: request.id },
    data: {
      status: "confirmed",
      confirmedBy: params.confirmingAdminUserId,
      confirmedAt: new Date(),
    },
  });

  const result = await banProduct({
    productId: request.productId,
    adminUserId: params.confirmingAdminUserId,
    requestedBy: request.requestedBy,
    reason: request.reason,
  });

  await logAuditEvent({
    userId: params.confirmingAdminUserId,
    action: "admin.listing_ban_confirmed",
    resourceType: "product",
    resourceId: request.productId,
    ipAddress: "internal",
    newValues: { requestId: request.id, requestedBy: request.requestedBy },
  });

  return result;
}

// ── Cancel a pending ban request ──────────────────────────────────────────

export async function cancelProductBanRequest(params: {
  productId: string;
  adminUserId: string;
}) {
  const request = await prisma.productBanRequest.findFirst({
    where: { productId: params.productId, status: "pending" },
  });
  if (!request) {
    throw new AppError("VALIDATION_ERROR", { productId: "No pending ban request found for this listing." });
  }

  await prisma.productBanRequest.update({
    where: { id: request.id },
    data: {
      status: "cancelled",
      cancelledBy: params.adminUserId,
      cancelledAt: new Date(),
    },
  });

  await logAuditEvent({
    userId: params.adminUserId,
    action: "admin.listing_ban_request_cancelled",
    resourceType: "product",
    resourceId: request.productId,
    ipAddress: "internal",
    newValues: { requestId: request.id },
  });

  return { requestId: request.id, status: "cancelled" as const };
}
