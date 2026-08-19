// ─────────────────────────────────────────────────────────────────────────
// lib/sellers/verification.service.ts
//
// All Phase 3 business logic: per-seller-type document requirements,
// document submission, and admin review (approve/reject).
//
// Referenced by a comment in schema.prisma ("See lib/sellers/
// verification.service.ts for the exact per-seller-type requirement
// logic") but not included in the phase-3 upload — this is that file.
//
// DESIGN NOTE — one deliberate change to already-shipped Phase 2 code:
// seller.service.ts's VALID_TRANSITIONS only allowed pending_approval ->
// ["active", "rejected"]. This service needs pending_approval ->
// pending_kyc too: when an admin rejects ONE document, the better UX is
// to let the seller fix just that document, not restart the whole
// application. The acceptance criteria says "approve, or reject *a
// submission*" (singular document), not "reject the application" — so a
// per-document rejection bounces the seller back to pending_kyc rather
// than to the terminal seller-level `rejected` status, which stays
// reserved for a real, considered whole-application rejection (not built
// in this phase — there's no UI/route here that ever sets it). See the
// PATCH note at the bottom of this file for the one-line change needed in
// seller.service.ts.
// ─────────────────────────────────────────────────────────────────────────

import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors";
import { logAuditEvent } from "@/lib/audit";
import { transitionSellerStatus } from "@/lib/sellers/seller.service";
import {
  validateKycDocument,
  uploadKycDocument,
  getSignedKycDocumentUrl,
} from "@/lib/storage/kyc-documents";
import { hashIdentityValue } from "@/lib/security/identity-hash";
import {
  sendSellerKycApprovedEmail,
  sendSellerKycDocumentRejectedEmail,
} from "@/lib/email/send";
import { checkBanEvasion } from "@/lib/sellers/ban-evasion.service";

export type SellerDocType =
  | "national_id"
  | "passport"
  | "business_registration"
  | "trade_license"
  | "tax_certificate";

// IdentityType is narrower than SellerDocType — trade_license has no
// corresponding identity number to hash (a license isn't a personal/
// business identifier in the same sense the others are).
const IDENTITY_TYPE_FOR_DOC: Partial<
  Record<SellerDocType, "national_id" | "passport" | "business_reg" | "tax_id">
> = {
  national_id: "national_id",
  passport: "passport",
  business_registration: "business_reg",
  tax_certificate: "tax_id",
};

interface RequirementGroup {
  key: string;
  label: string;
  docTypes: SellerDocType[]; // satisfied if ANY one of these is verified/submitted
}

// "individual" needs exactly one personal-ID document.
// "business" needs that SAME personal ID (the business is operated by a
// person, who still needs to be identified) PLUS all three business
// documents individually — per the scaling doc's "additional business
// documents" framing.
const REQUIREMENTS: Record<"individual" | "business", RequirementGroup[]> = {
  individual: [
    { key: "personal_id", label: "Personal ID (National ID or Passport)", docTypes: ["national_id", "passport"] },
  ],
  business: [
    { key: "personal_id", label: "Personal ID (National ID or Passport)", docTypes: ["national_id", "passport"] },
    { key: "business_registration", label: "Business Registration Certificate", docTypes: ["business_registration"] },
    { key: "trade_license", label: "Trade License", docTypes: ["trade_license"] },
    { key: "tax_certificate", label: "Tax Certificate", docTypes: ["tax_certificate"] },
  ],
};

export function getRequirementGroups(sellerType: "individual" | "business"): RequirementGroup[] {
  return REQUIREMENTS[sellerType];
}

/** Every doc type that's ever relevant to this seller type — drives which upload fields the UI shows. */
export function getAllowedDocTypes(sellerType: "individual" | "business"): SellerDocType[] {
  return REQUIREMENTS[sellerType].flatMap((g) => g.docTypes);
}

interface RequirementStatusGroup {
  key: string;
  label: string;
  satisfied: boolean; // true if any doc in this group is submitted or verified
  verified: boolean; // true only if the satisfying doc is specifically verified
  rejected: boolean; // true if the only submission(s) in this group were rejected
}

export interface RequirementStatus {
  groups: RequirementStatusGroup[];
  allSubmitted: boolean; // every group has at least one non-rejected submission
  allVerified: boolean; // every group's satisfying document is admin-verified
}

function computeRequirementStatus(
  sellerType: "individual" | "business",
  verifications: { docType: string; status: string }[]
): RequirementStatus {
  const byDocType = new Map(verifications.map((v) => [v.docType, v.status]));

  const groups: RequirementStatusGroup[] = getRequirementGroups(sellerType).map((g) => {
    const statuses = g.docTypes.map((dt) => byDocType.get(dt)).filter(Boolean);
    const verified = statuses.includes("verified");
    const submitted = statuses.includes("submitted") || verified;
    const onlyRejected = statuses.length > 0 && !submitted && statuses.every((s) => s === "rejected");
    return { key: g.key, label: g.label, satisfied: submitted, verified, rejected: onlyRejected };
  });

  return {
    groups,
    allSubmitted: groups.every((g) => g.satisfied),
    allVerified: groups.every((g) => g.verified),
  };
}

// ── Submission ─────────────────────────────────────────────────────────

export async function submitVerificationDocument(params: {
  sellerId: string;
  sellerType: "individual" | "business";
  actorUserId: string;
  docType: SellerDocType;
  fileBuffer: Buffer;
  identityNumber?: string;
}): Promise<RequirementStatus> {
  const allowed = getAllowedDocTypes(params.sellerType);
  if (!allowed.includes(params.docType)) {
    throw new AppError("VALIDATION_ERROR", {
      docType: `${params.docType} is not a required or accepted document for ${params.sellerType} sellers.`,
    });
  }

  const seller = await prisma.seller.findUnique({
    where: { id: params.sellerId },
    select: { status: true },
  });
  if (!seller) throw new AppError("VALIDATION_ERROR", { sellerId: "Seller not found." });
  if (seller.status !== "pending_kyc" && seller.status !== "pending_approval") {
    throw new AppError("VALIDATION_ERROR", {
      status: "Document submission is not currently open for your application.",
    });
  }

  const validation = validateKycDocument(params.fileBuffer);
  if (!validation.valid) {
    throw new AppError("UPLOAD_INVALID_TYPE", { file: validation.reason });
  }

  const { publicId } = await uploadKycDocument(params.fileBuffer, params.sellerId, params.docType);

  await prisma.$transaction(async (tx) => {
    // Upsert on the unique [sellerId, docType] constraint — a resubmission
    // (e.g. after rejection) overwrites the prior row and resets review
    // state, rather than creating a duplicate.
    await tx.sellerVerification.upsert({
      where: { sellerId_docType: { sellerId: params.sellerId, docType: params.docType } },
      create: { sellerId: params.sellerId, docType: params.docType, fileRef: publicId, status: "submitted" },
      update: {
        fileRef: publicId,
        status: "submitted",
        rejectionReason: null,
        reviewedBy: null,
        reviewedAt: null,
      },
    });

    const identityType = IDENTITY_TYPE_FOR_DOC[params.docType];
    if (identityType && params.identityNumber) {
      const hash = hashIdentityValue(params.identityNumber);
      await tx.sellerIdentityHash.upsert({
        where: { sellerId_identityType: { sellerId: params.sellerId, identityType } },
        create: { sellerId: params.sellerId, identityType, hash },
        update: { hash },
      });
    }
  });

  await logAuditEvent({
    userId: params.actorUserId,
    action: "seller.kyc_document_submitted",
    resourceType: "seller_verification",
    resourceId: params.sellerId,
    ipAddress: "internal", // caller (the API route) logs the real IP separately if needed
    newValues: { docType: params.docType },
  });

  const verifications = await prisma.sellerVerification.findMany({
    where: { sellerId: params.sellerId },
    select: { docType: true, status: true },
  });
  const reqStatus = computeRequirementStatus(params.sellerType, verifications);

  // Auto-advance pending_kyc -> pending_approval once every required
  // group has at least one non-rejected submission. Submission alone is
  // enough to advance — admin verification happens AFTER this, while the
  // seller sits in pending_approval (matches the acceptance criteria:
  // "cannot proceed past pending_kyc without all required documents...
  // submitted", not "...verified").
  if (seller.status === "pending_kyc" && reqStatus.allSubmitted) {
    await transitionSellerStatus(params.sellerId, "pending_approval", params.actorUserId);
  }

  return reqStatus;
}

// ── Status query ──────────────────────────────────────────────────────

export async function getVerificationStatus(userId: string) {
  const seller = await prisma.seller.findUnique({
    where: { userId },
    select: { id: true, sellerType: true, status: true },
  });
  if (!seller) return null;

  const verifications = await prisma.sellerVerification.findMany({
    where: { sellerId: seller.id },
    select: { docType: true, status: true, rejectionReason: true },
  });

  return {
    sellerStatus: seller.status,
    requirements: computeRequirementStatus(seller.sellerType, verifications),
    documents: verifications,
  };
}

// ── Admin queue ──────────────────────────────────────────────────────────

export async function getVerificationQueue(params: { page: number; pageSize: number }) {
  const where = { status: "submitted" as const };

  const [total, rows] = await Promise.all([
    prisma.sellerVerification.count({ where }),
    prisma.sellerVerification.findMany({
      where,
      orderBy: { createdAt: "asc" }, // oldest first — FIFO review queue
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
      select: {
        id: true,
        docType: true,
        fileRef: true,
        createdAt: true,
        seller: {
          select: { id: true, sellerType: true, displayName: true, businessEmail: true },
        },
      },
    }),
  ]);

  // Signed URL generated fresh, right before the response goes out — per
  // the "short-lived" requirement, this is never persisted, just handed
  // to the admin's browser for this one page load.
  const items = rows.map((row) => ({
    id: row.id,
    docType: row.docType,
    createdAt: row.createdAt,
    seller: row.seller,
    previewUrl: getSignedKycDocumentUrl(row.fileRef),
  }));

  return { items, total, page: params.page, pageSize: params.pageSize };
}

// ── Admin review ──────────────────────────────────────────────────────────

export async function reviewVerificationDocument(params: {
  verificationId: string;
  action: "approve" | "reject";
  reviewerId: string;
  rejectionReason?: string;
}) {
  if (params.action === "reject" && !params.rejectionReason) {
    throw new AppError("VALIDATION_ERROR", { rejectionReason: "A reason is required when rejecting a document." });
  }

  const record = await prisma.sellerVerification.findUnique({
    where: { id: params.verificationId },
    include: { seller: { select: { id: true, sellerType: true, status: true, userId: true, businessEmail: true, displayName: true } } },
  });
  if (!record) throw new AppError("VALIDATION_ERROR", { verificationId: "Verification record not found." });
  if (record.status !== "submitted") {
    throw new AppError("VALIDATION_ERROR", { status: "This document has already been reviewed." });
  }

  const newDocStatus = params.action === "approve" ? "verified" : "rejected";

  await prisma.sellerVerification.update({
    where: { id: params.verificationId },
    data: {
      status: newDocStatus,
      reviewedBy: params.reviewerId,
      reviewedAt: new Date(),
      rejectionReason: params.action === "reject" ? params.rejectionReason : null,
    },
  });

  await logAuditEvent({
    userId: params.reviewerId,
    action: params.action === "approve" ? "admin.kyc_document_approved" : "admin.kyc_document_rejected",
    resourceType: "seller_verification",
    resourceId: params.verificationId,
    ipAddress: "internal",
    newValues: { docType: record.docType, sellerId: record.sellerId, rejectionReason: params.rejectionReason },
  });

  const allVerifications = await prisma.sellerVerification.findMany({
    where: { sellerId: record.sellerId },
    select: { docType: true, status: true },
  });
  const reqStatus = computeRequirementStatus(record.seller.sellerType, allVerifications);

  const sellerEmail = record.seller.businessEmail ?? undefined;
  const sellerName = record.seller.displayName ?? "Seller";

  if (params.action === "reject") {
    // Bounce back to pending_kyc so the seller can fix just this document
    // — see the file header comment for why, and the patch note below for
    // the one-line change this requires in seller.service.ts.
    if (record.seller.status === "pending_approval") {
      await transitionSellerStatus(record.seller.id, "pending_kyc", params.reviewerId);
    }
    if (sellerEmail) {
      await sendSellerKycDocumentRejectedEmail(sellerEmail, sellerName, record.docType, params.rejectionReason!);
    }
  } else if (reqStatus.allVerified && record.seller.status === "pending_approval") {
    // Phase 11: Run ban-evasion check BEFORE activating. If any identity
    // hash matches a banned seller, create a BanEvasionAlert and block
    // activation until an admin resolves the alert.
    const banCheck = await checkBanEvasion(record.sellerId, params.reviewerId);
    if (banCheck.hasPendingAlert) {
      // Surface the block to the admin reviewing the document —
      // they need to resolve the alert via /admin/ban-evasion-alerts first.
      throw new AppError("VALIDATION_ERROR", {
        banEvasion:
          `Activation blocked: ${banCheck.alerts.length} ban-evasion alert${banCheck.alerts.length > 1 ? "s" : ""} pending review. ` +
          `Resolve them at /admin/ban-evasion-alerts before approving this seller.`,
      });
    }

    // No pending alerts — activate the seller.
    await transitionSellerStatus(record.seller.id, "active", params.reviewerId);
    if (sellerEmail) {
      await sendSellerKycApprovedEmail(sellerEmail, sellerName);
    }
  }

  return { docStatus: newDocStatus, requirements: reqStatus };
}

// ─────────────────────────────────────────────────────────────────────────
// NOTE: lib/sellers/seller.service.ts (Phase 2) is included in this
// delivery with VALID_TRANSITIONS patched — pending_approval now also
// allows -> pending_kyc. That's the only change made to that file. Use
// the copy in this zip, not your existing Phase 2 one.
// ─────────────────────────────────────────────────────────────────────────
