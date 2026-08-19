// lib/sellers/listing-moderation.service.ts
//
// Phase 5 gap fill: "new/edited listings can be flagged for Admin review
// based on existing category/content rules."
//
// Design: this is a light-touch, rule-based auto-flag, not a blanket
// "every listing needs approval" gate — that would be a much heavier
// change to the seller experience than the spec asked for. Two rules,
// either of which raises a flag:
//   1. The listing's category has requiresManualReview = true (admin-set,
//      e.g. for health claims or safety-regulated categories).
//   2. The listing's name/description matches a banned-term list (a
//      starting point, not a complete content-moderation system — see
//      the constant below).
//
// A flagged listing is NOT rejected — createListing/updateListing still
// succeed, but the product's status is force-set to "draft" regardless
// of what the seller requested, and a ListingModerationFlag row records
// why. The seller sees this via the response's `moderationPending: true`
// flag. Once an admin clears the flag, the seller can activate normally.

import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors";
import { logAuditEvent } from "@/lib/audit";
import { createNotification } from "@/lib/notifications/notifications.service";

// Starting point only — a real deployment should probably load this from
// an admin-editable settings table rather than a hardcoded list, but that
// was out of scope for closing this specific gap. Documented here as an
// honest limitation, the same way the SMS provider was left as an
// explicit stub earlier in this project.
const BANNED_TERMS = [
  "guaranteed cure",
  "miracle",
  "counterfeit",
  "replica",
  "fake ",
];

export interface ModerationCheckResult {
  flagged: boolean;
  reason?: string;
}

export async function checkListingForModeration(params: {
  categoryId: string;
  name: string;
  description: string;
}): Promise<ModerationCheckResult> {
  const category = await prisma.category.findUnique({
    where: { id: params.categoryId },
    select: { requiresManualReview: true, name: true },
  });

  if (category?.requiresManualReview) {
    return {
      flagged: true,
      reason: `Category "${category.name}" requires manual review for all new listings.`,
    };
  }

  const haystack = `${params.name} ${params.description}`.toLowerCase();
  const hit = BANNED_TERMS.find((term) => haystack.includes(term));
  if (hit) {
    return {
      flagged: true,
      reason: `Listing content matched a restricted term ("${hit.trim()}") and requires manual review.`,
    };
  }

  return { flagged: false };
}

/**
 * Raises a flag for a listing and notifies the seller. Called from
 * listings.service.ts's createListing/updateListing when
 * checkListingForModeration() returns flagged: true.
 */
export async function raiseModerationFlag(params: {
  productId: string;
  sellerId: string;
  sellerUserId: string;
  reason: string;
}) {
  await prisma.listingModerationFlag.create({
    data: {
      productId: params.productId,
      reason: params.reason,
      status: "pending",
      raisedBy: "system",
    },
  });

  await logAuditEvent({
    userId: params.sellerUserId,
    action: "system.listing_flagged_for_review",
    resourceType: "product",
    resourceId: params.productId,
    ipAddress: "internal",
    newValues: { reason: params.reason },
  });

  await createNotification({
    userId: params.sellerUserId,
    type: "listing_moderation",
    payload: { productId: params.productId, reason: params.reason, outcome: "pending" },
  });
}

export async function getModerationQueue(params: { page: number; pageSize: number }) {
  const where = { status: "pending" as const };

  const [items, total] = await Promise.all([
    prisma.listingModerationFlag.findMany({
      where,
      orderBy: { createdAt: "asc" },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            sellerId: true,
            seller: { select: { displayName: true, businessEmail: true } },
          },
        },
      },
    }),
    prisma.listingModerationFlag.count({ where }),
  ]);

  return { items, total, page: params.page, pageSize: params.pageSize, totalPages: Math.ceil(total / params.pageSize) };
}

export async function resolveModerationFlag(params: {
  flagId: string;
  action: "clear" | "reject";
  adminUserId: string;
  note?: string;
}) {
  const flag = await prisma.listingModerationFlag.findUnique({
    where: { id: params.flagId },
    include: { product: { select: { id: true, sellerId: true, seller: { select: { userId: true } } } } },
  });
  if (!flag) throw new AppError("VALIDATION_ERROR", { flagId: "Moderation flag not found." });
  if (flag.status !== "pending") {
    throw new AppError("VALIDATION_ERROR", { status: "This flag has already been resolved." });
  }

  const newStatus = params.action === "clear" ? "cleared" : "rejected";

  await prisma.$transaction(async (tx) => {
    await tx.listingModerationFlag.update({
      where: { id: params.flagId },
      data: {
        status: newStatus,
        resolvedBy: params.adminUserId,
        resolutionNote: params.note,
        resolvedAt: new Date(),
      },
    });

    if (params.action === "clear") {
      // Only now is the seller allowed to activate the listing — clearing
      // the flag doesn't force it active, just unblocks the seller's own
      // next attempt to set status: "active".
    } else {
      // Rejected — force the listing to archived so it can never go live
      // as currently written; seller must edit and resubmit.
      await tx.product.update({
        where: { id: flag.productId },
        data: { status: "archived" },
      });
    }
  });

  await logAuditEvent({
    userId: params.adminUserId,
    action: params.action === "clear" ? "admin.listing_flag_cleared" : "admin.listing_flag_rejected",
    resourceType: "listing_moderation_flag",
    resourceId: params.flagId,
    ipAddress: "internal",
    newValues: { note: params.note },
  });

  if (flag.product.seller.userId) {
    await createNotification({
      userId: flag.product.seller.userId,
      type: "listing_moderation",
      payload: { productId: flag.productId, outcome: newStatus, note: params.note },
    });
  }

  return { flagId: params.flagId, newStatus };
}

/** Does this product currently have an unresolved moderation flag? Used by listings.service.ts to block activation. */
export async function hasPendingModerationFlag(productId: string): Promise<boolean> {
  const count = await prisma.listingModerationFlag.count({
    where: { productId, status: "pending" },
  });
  return count > 0;
}
