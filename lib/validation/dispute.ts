import { z } from "zod";

// ── Buyer: open a dispute ─────────────────────────────────────────────────
export const openDisputeSchema = z.object({
  type: z.enum(["return", "refund", "chargeback"]),
  buyerReason: z
    .string()
    .trim()
    .min(20, "Please describe the issue in at least 20 characters.")
    .max(2000),
});

// ── Seller: respond to a dispute ──────────────────────────────────────────
export const sellerRespondSchema = z.object({
  action: z.enum(["accept", "reject", "escalate"]),
  // Required when rejecting — shown to buyer and admin
  sellerResponse: z
    .string()
    .trim()
    .min(10, "Please provide a reason of at least 10 characters.")
    .max(2000),
});

// ── Admin: resolve a dispute ──────────────────────────────────────────────
export const adminResolveSchema = z.object({
  outcome: z.enum(["refund", "deny"]),
  resolutionNotes: z
    .string()
    .trim()
    .min(10, "Resolution notes must be at least 10 characters.")
    .max(2000),
  // Full refund if omitted; partial if provided. Must be > 0 and ≤ order
  // item total — validated in dispute.service.ts against the live DB value.
  refundAmount: z.number().positive().optional(),
});

export type OpenDisputeInput    = z.infer<typeof openDisputeSchema>;
export type SellerRespondInput  = z.infer<typeof sellerRespondSchema>;
export type AdminResolveInput   = z.infer<typeof adminResolveSchema>;
