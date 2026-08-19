import { z } from "zod";

export const sellerDocTypeSchema = z.enum([
  "national_id",
  "passport",
  "business_registration",
  "trade_license",
  "tax_certificate",
]);

// Identity number is optional on the upload request — only required for
// docType values that feed seller_identity_hashes (national_id, passport,
// business_registration, tax_certificate all have a corresponding number;
// trade_license does not, per IdentityType being narrower than
// SellerDocType — see lib/security/identity-hash.ts).
export const submitVerificationSchema = z.object({
  docType: sellerDocTypeSchema,
  identityNumber: z.string().min(3).max(64).optional(),
});

export const reviewVerificationSchema = z.object({
  rejectionReason: z.string().min(3).max(500).optional(),
});
