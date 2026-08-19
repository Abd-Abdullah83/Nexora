import { z } from "zod";

export const suspendProductSchema = z.object({
  reason: z.string().trim().min(10, "Reason must be at least 10 characters."),
});

export const reinstateProductSchema = z.object({
  reason: z.string().trim().min(10, "Reason must be at least 10 characters."),
});

export const requestProductBanSchema = z.object({
  reason: z.string().trim().min(10, "Reason must be at least 10 characters."),
});

export const cancelProductBanRequestSchema = z.object({
  note: z.string().trim().max(500).optional(),
});
