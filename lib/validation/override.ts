import { z } from "zod";

export const overrideReasonSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(10, "Reason must be at least 10 characters — document your intervention clearly.")
    .max(1000),
});

export const escrowReleaseSchema = overrideReasonSchema;
export const escrowUnfreezeSchema = overrideReasonSchema;
export const orderForceCompleteSchema = overrideReasonSchema;
export const orderForceCancelSchema = overrideReasonSchema;
export const listingForceArchiveSchema = overrideReasonSchema;
export const listingForceReactivateSchema = overrideReasonSchema;

export const updateCommissionSchema = z.object({
  sellerType: z.enum(["individual", "business"]),
  newRatePercent: z
    .number()
    .positive()
    .max(50, "Commission rate cannot exceed 50%.")
    .multipleOf(0.01),
});

export const auditLogQuerySchema = z.object({
  action: z.string().optional(),
  resourceType: z.string().optional(),
  userId: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(50),
});

export type UpdateCommissionInput = z.infer<typeof updateCommissionSchema>;
