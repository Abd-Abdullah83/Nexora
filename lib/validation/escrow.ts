import { z } from "zod";

export const freezeEscrowSchema = z.object({
  reason: z.string().trim().min(10, "Please provide a reason of at least 10 characters for the freeze.").max(500),
});

export const escrowQueueQuerySchema = z.object({
  status: z.enum(["held", "released", "frozen", "disputed"]).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});
