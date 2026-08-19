// ─────────────────────────────────────────────────────────────────────────
// lib/sellers/ban-evasion.service.ts
//
// Phase 11 — Identity duplicate detection & ban-evasion prevention.
//
// ── How it works ─────────────────────────────────────────────────────────
// Every identity number submitted at KYC (Phase 3) is stored as an
// HMAC-SHA256 hash in seller_identity_hashes. This service queries those
// hashes when a seller is about to be activated, looking for any match
// against the hashes of BANNED sellers.
//
// A match doesn't auto-reject the seller — it creates a BanEvasionAlert
// and surfaces it to admin. Reason: legitimate edge cases exist (two family
// members with the same national ID in some countries, genuine data-entry
// errors). Ban-evasion detection is a human-in-the-loop system.
//
// ── When it runs ─────────────────────────────────────────────────────────
// Called from verification.service.ts's adminApproveKyc() BEFORE the
// seller status is set to "active". If a pending alert exists, approval
// is BLOCKED until the admin resolves it via
// POST /api/admin/sellers/[id]/ban or
// POST /api/admin/ban-evasion-alerts/[id]/approve.
//
// ── What it does NOT do ──────────────────────────────────────────────────
// - It does not compare suspended sellers' hashes (only banned ones).
//   A suspended seller may be reinstated; a banned one may not register again.
// - It does not run on every login — only at KYC approval.
// - It does not auto-ban. Human decision always required.
// ─────────────────────────────────────────────────────────────────────────

import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors";
import { logAuditEvent } from "@/lib/audit";

export interface DuplicateCheckResult {
  hasPendingAlert: boolean;       // existing unresolved alert — approval blocked
  newAlertCreated: boolean;       // a new alert was just created this call
  alerts: {
    id: string;
    matchedSellerId: string;
    matchedIdentityType: string;
    status: string;
  }[];
}

// ── Core duplicate check ──────────────────────────────────────────────────

/**
 * Check this seller's identity hashes against all banned sellers' hashes.
 * Called at KYC approval time. Returns a result object the caller uses to
 * decide whether to proceed with activation or surface the alert to admin.
 *
 * Safe to call multiple times — upserts alerts by (newSellerId,
 * matchedHashId) so duplicate detection runs are idempotent.
 */
export async function checkBanEvasion(
  sellerId: string,
  actorAdminId: string
): Promise<DuplicateCheckResult> {
  // Get all identity hashes for this seller
  const sellerHashes = await prisma.sellerIdentityHash.findMany({
    where: { sellerId },
    select: { id: true, hash: true, identityType: true },
  });

  if (sellerHashes.length === 0) {
    // No identity hashes yet — KYC may not be complete. Not a ban evasion
    // signal, just an incomplete application. The verification flow should
    // prevent reaching here without hashes, but guard defensively.
    return { hasPendingAlert: false, newAlertCreated: false, alerts: [] };
  }

  // Find any banned seller who shares at least one of these hashes.
  // We query SellerIdentityHash table joining to sellers where status=banned.
  // This is a cross-seller query — explicitly scoped to banned sellers only.
  const matchingBannedHashes = await prisma.sellerIdentityHash.findMany({
    where: {
      hash: { in: sellerHashes.map((h) => h.hash) },
      sellerId: { not: sellerId }, // not the same seller
      seller: { status: "banned" },
    },
    select: {
      id: true,
      hash: true,
      identityType: true,
      sellerId: true,
    },
  });

  let newAlertCreated = false;

  // Create BanEvasionAlert for each match (idempotent — skip if already exists)
  for (const match of matchingBannedHashes) {
    const existing = await prisma.banEvasionAlert.findFirst({
      where: { newSellerId: sellerId, matchedHashId: match.id },
    });

    if (!existing) {
      await prisma.banEvasionAlert.create({
        data: {
          newSellerId: sellerId,
          matchedSellerId: match.sellerId,
          matchedIdentityType: match.identityType,
          matchedHashId: match.id,
          status: "pending",
        },
      });
      newAlertCreated = true;

      await logAuditEvent({
        userId: actorAdminId,
        action: "admin.ban_evasion_alert_created",
        resourceType: "seller",
        resourceId: sellerId,
        ipAddress: "internal",
        newValues: {
          matchedSellerId: match.sellerId,
          matchedIdentityType: match.identityType,
        },
      });
    }
  }

  // Check for any unresolved (pending) alerts — these block activation
  const pendingAlerts = await prisma.banEvasionAlert.findMany({
    where: { newSellerId: sellerId, status: "pending" },
    select: { id: true, matchedSellerId: true, matchedIdentityType: true, status: true },
  });

  return {
    hasPendingAlert: pendingAlerts.length > 0,
    newAlertCreated,
    alerts: pendingAlerts,
  };
}

// ── Admin: resolve an alert ───────────────────────────────────────────────

/**
 * Admin decides the duplicate match is NOT ban evasion — proceed with
 * activating the seller. Marks the alert as "approved" and clears the
 * block on activation.
 */
export async function approveBanEvasionAlert(
  alertId: string,
  adminUserId: string,
  adminNote: string
): Promise<void> {
  const alert = await prisma.banEvasionAlert.findUnique({ where: { id: alertId } });
  if (!alert) throw new AppError("VALIDATION_ERROR", { id: "Alert not found." });
  if (alert.status !== "pending") {
    throw new AppError("VALIDATION_ERROR", {
      status: `Alert is already "${alert.status}" — cannot approve again.`,
    });
  }

  await prisma.banEvasionAlert.update({
    where: { id: alertId },
    data: {
      status: "approved",
      resolvedBy: adminUserId,
      resolvedAt: new Date(),
      adminNote: adminNote || "Approved — not ban evasion.",
    },
  });

  await logAuditEvent({
    userId: adminUserId,
    action: "admin.ban_evasion_alert_approved",
    resourceType: "ban_evasion_alert",
    resourceId: alertId,
    ipAddress: "internal",
    newValues: { newSellerId: alert.newSellerId, adminNote },
  });
}

// ── Admin: get pending alerts queue ──────────────────────────────────────

export async function getPendingBanEvasionAlerts(params: {
  page?: number;
  pageSize?: number;
}) {
  const { page = 1, pageSize = 25 } = params;

  const [items, total] = await Promise.all([
    prisma.banEvasionAlert.findMany({
      where: { status: "pending" },
      orderBy: { createdAt: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        newSeller: {
          select: {
            id: true,
            displayName: true,
            sellerType: true,
            businessEmail: true,
            status: true,
          },
        },
      },
    }),
    prisma.banEvasionAlert.count({ where: { status: "pending" } }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}
