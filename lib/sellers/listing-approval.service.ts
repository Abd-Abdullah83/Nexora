// ─────────────────────────────────────────────────────────────────────────
// lib/sellers/listing-approval.service.ts
//
// THE core gate for the marketplace listing-approval system. Every place
// that lets a seller set a product's status to "active" must run that
// requested status through resolveSellerSubmittedStatus() first — never
// write a seller-requested "active" straight to the database.
//
// Trust model (per the scaling decision):
//   • A seller's first 5 APPROVED listings go through admin review.
//   • Beyond that, the seller is NOT auto-promoted — an admin must
//     manually flag them isTrustedSeller=true via the trust-grant route.
//   • Once isTrustedSeller is true, every future submission (new or
//     edited) goes straight to "active" with no review step.
//   • A rejected listing does not count toward approvedListingCount —
//     only genuine approvals do, so a seller can't pad the count with
//     junk submissions that get bounced.
//
// This file has ZERO Next.js imports — pure business logic, testable in
// isolation, importable from both the listings service and any future
// caller (e.g. a bulk-import tool) without restriction.
// ─────────────────────────────────────────────────────────────────────────

import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors";
import { logAuditEvent } from "@/lib/audit";

const TRUST_THRESHOLD = 5; // approved listings needed before an admin CAN grant trust

export type ResolvedListingStatus = "draft" | "pending_review" | "active" | "archived";

/**
 * Given what a seller is REQUESTING (their chosen status) and that
 * seller's current trust state, returns what the status should ACTUALLY
 * be written as.
 *
 * - Requesting "draft" or "archived" always passes through unchanged —
 *   there's nothing to gate; the product isn't going live either way.
 * - Requesting "active" is the only case that's gated:
 *     trusted seller  -> "active" (no review)
 *     untrusted seller -> "pending_review" (admin must approve)
 */
export async function resolveSellerSubmittedStatus(
  sellerId: string,
  requestedStatus: "draft" | "active" | "archived"
): Promise<ResolvedListingStatus> {
  if (requestedStatus !== "active") {
    return requestedStatus;
  }

  const seller = await prisma.seller.findUnique({
    where: { id: sellerId },
    select: { isTrustedSeller: true },
  });

  if (!seller) {
    throw new AppError("VALIDATION_ERROR", { sellerId: "Seller not found." });
  }

  return seller.isTrustedSeller ? "active" : "pending_review";
}

/**
 * Returns the seller's current trust standing — used by the listings UI
 * to show "X of 5 listings approved" progress and explain why a listing
 * is sitting in pending_review instead of going live immediately.
 */
export async function getSellerTrustStanding(sellerId: string) {
  const seller = await prisma.seller.findUnique({
    where: { id: sellerId },
    select: {
      isTrustedSeller: true,
      approvedListingCount: true,
      trustGrantedAt: true,
    },
  });
  if (!seller) throw new AppError("VALIDATION_ERROR", { sellerId: "Seller not found." });

  return {
    isTrustedSeller: seller.isTrustedSeller,
    approvedListingCount: seller.approvedListingCount,
    trustThreshold: TRUST_THRESHOLD,
    eligibleForTrustGrant: !seller.isTrustedSeller && seller.approvedListingCount >= TRUST_THRESHOLD,
    trustGrantedAt: seller.trustGrantedAt,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Admin-side actions
// ─────────────────────────────────────────────────────────────────────────

export async function getListingReviewQueue(params: {
  page?: number;
  pageSize?: number;
}) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, params.pageSize ?? 20));
  const skip = (page - 1) * pageSize;

  const where = { status: "pending_review" as const, deletedAt: null };

  const [total, items] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: { createdAt: "asc" }, // oldest submissions first — FIFO queue
      skip,
      take: pageSize,
      select: {
        id: true,
        name: true,
        slug: true,
        price: true,
        sku: true,
        createdAt: true,
        seller: {
          select: { id: true, displayName: true, approvedListingCount: true },
        },
        category: { select: { name: true } },
        images: {
          where: { isPrimary: true },
          take: 1,
          select: { url: true, altText: true },
        },
      },
    }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

/**
 * Approves a pending_review listing: flips it to active, stamps the
 * review trail, and increments the seller's approvedListingCount. Does
 * NOT auto-grant trust even if this approval crosses the threshold —
 * per the scaling decision, trust is a deliberate, separate admin action
 * (see grantSellerTrust below), not an automatic side effect of hitting
 * a number.
 */
export async function approveListing(productId: string, adminUserId: string) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, sellerId: true, status: true, name: true },
  });
  if (!product) throw new AppError("VALIDATION_ERROR", { id: "Listing not found." });
  if (product.status !== "pending_review") {
    throw new AppError("VALIDATION_ERROR", {
      status: `Cannot approve a listing with status "${product.status}".`,
    });
  }
  if (!product.sellerId) {
    throw new AppError("VALIDATION_ERROR", { sellerId: "Listing has no seller." });
  }

  const [updated] = await prisma.$transaction([
    prisma.product.update({
      where: { id: productId },
      data: {
        status: "active",
        reviewedBy: adminUserId,
        reviewedAt: new Date(),
        rejectionReason: null,
      },
    }),
    prisma.seller.update({
      where: { id: product.sellerId },
      data: { approvedListingCount: { increment: 1 } },
    }),
  ]);

  await logAuditEvent({
    userId: adminUserId,
    action: "admin.listing_approved",
    resourceType: "product",
    resourceId: productId,
    ipAddress: "internal",
    newValues: { status: "active", sellerId: product.sellerId },
  });

  return updated;
}

/**
 * Rejects a pending_review listing. The product moves to "rejected"
 * (not deleted) so the seller can see why and resubmit — resubmission
 * just means editing it and choosing "active" again, which re-runs it
 * through resolveSellerSubmittedStatus() exactly like a fresh submission.
 * Rejections do NOT increment approvedListingCount.
 */
export async function rejectListing(
  productId: string,
  adminUserId: string,
  reason: string
) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, sellerId: true, status: true },
  });
  if (!product) throw new AppError("VALIDATION_ERROR", { id: "Listing not found." });
  if (product.status !== "pending_review") {
    throw new AppError("VALIDATION_ERROR", {
      status: `Cannot reject a listing with status "${product.status}".`,
    });
  }

  const updated = await prisma.product.update({
    where: { id: productId },
    data: {
      status: "rejected",
      reviewedBy: adminUserId,
      reviewedAt: new Date(),
      rejectionReason: reason,
    },
  });

  await logAuditEvent({
    userId: adminUserId,
    action: "admin.listing_rejected",
    resourceType: "product",
    resourceId: productId,
    ipAddress: "internal",
    newValues: { status: "rejected", reason },
  });

  return updated;
}

/**
 * Manually flags a seller as trusted, skipping the review gate for all
 * future submissions. Deliberately requires the seller to have already
 * crossed TRUST_THRESHOLD approved listings — this is enforced here, not
 * just hinted at in the UI, so the gate can't be bypassed by calling this
 * route directly on a brand-new seller.
 */
export async function grantSellerTrust(sellerId: string, adminUserId: string) {
  const seller = await prisma.seller.findUnique({
    where: { id: sellerId },
    select: { id: true, isTrustedSeller: true, approvedListingCount: true, displayName: true },
  });
  if (!seller) throw new AppError("VALIDATION_ERROR", { sellerId: "Seller not found." });
  if (seller.isTrustedSeller) {
    throw new AppError("VALIDATION_ERROR", { isTrustedSeller: "Seller is already trusted." });
  }
  if (seller.approvedListingCount < TRUST_THRESHOLD) {
    throw new AppError("VALIDATION_ERROR", {
      approvedListingCount: `Seller needs at least ${TRUST_THRESHOLD} approved listings before trust can be granted (currently ${seller.approvedListingCount}).`,
    });
  }

  const updated = await prisma.seller.update({
    where: { id: sellerId },
    data: {
      isTrustedSeller: true,
      trustGrantedAt: new Date(),
      trustGrantedBy: adminUserId,
    },
  });

  await logAuditEvent({
    userId: adminUserId,
    action: "admin.seller_trust_granted",
    resourceType: "seller",
    resourceId: sellerId,
    ipAddress: "internal",
    newValues: { isTrustedSeller: true },
  });

  return updated;
}

/**
 * Revokes trust — e.g. after a quality complaint. Future submissions go
 * back through the review gate. Does not retroactively touch any
 * already-active listings.
 */
export async function revokeSellerTrust(sellerId: string, adminUserId: string, reason?: string) {
  const seller = await prisma.seller.findUnique({
    where: { id: sellerId },
    select: { id: true, isTrustedSeller: true },
  });
  if (!seller) throw new AppError("VALIDATION_ERROR", { sellerId: "Seller not found." });
  if (!seller.isTrustedSeller) {
    throw new AppError("VALIDATION_ERROR", { isTrustedSeller: "Seller is not currently trusted." });
  }

  const updated = await prisma.seller.update({
    where: { id: sellerId },
    data: { isTrustedSeller: false, trustGrantedAt: null, trustGrantedBy: null },
  });

  await logAuditEvent({
    userId: adminUserId,
    action: "admin.seller_trust_revoked",
    resourceType: "seller",
    resourceId: sellerId,
    ipAddress: "internal",
    newValues: { isTrustedSeller: false, reason },
  });

  return updated;
}
