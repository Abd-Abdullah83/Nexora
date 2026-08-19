import { z } from "zod";

// The existing banSellerSchema (in your current lib/validation/seller-enforcement.ts,
// shape: { reason: string }) is reused as-is for the ban REQUEST — its
// validation requirements don't change, only what the route does with a
// valid request has changed. No new schema needed for that step.

// Confirm takes no required body — the two-admin check itself is what
// matters, not any additional input. Kept as an object schema (not just
// "no body") so an optional note can be added later without a breaking change.
export const confirmBanRequestSchema = z.object({}).optional();

export const cancelBanRequestSchema = z.object({
  note: z.string().trim().max(500).optional(),
});
