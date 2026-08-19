// lib/validation/seller-order.ts
//
// Phase 6 — validation for seller-scoped order fulfillment updates.

import { z } from "zod";

export const updateFulfillmentSchema = z
  .object({
    status: z.enum(["confirmed", "shipped", "delivered", "cancelled"]),
    trackingNumber: z.string().min(1).max(100).optional(),
    trackingUrl: z.string().url().optional(),
    cancellationReason: z.string().min(5).max(500).optional(),
  })
  .refine(
    (data) => (data.status === "shipped" ? !!data.trackingNumber : true),
    { message: "trackingNumber is required when status is 'shipped'.", path: ["trackingNumber"] }
  )
  .refine(
    (data) => (data.status === "cancelled" ? !!data.cancellationReason : true),
    { message: "cancellationReason is required when status is 'cancelled'.", path: ["cancellationReason"] }
  );

export const orderListQuerySchema = z.object({
  status: z.enum(["pending", "confirmed", "shipped", "delivered", "cancelled"]).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

export type UpdateFulfillmentInput = z.infer<typeof updateFulfillmentSchema>;
