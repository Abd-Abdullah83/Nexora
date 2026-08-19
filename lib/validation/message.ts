// lib/validation/message.ts
import { z } from "zod";

export const sendMessageSchema = z.object({
  sellerId: z.string().uuid(),
  orderId: z.string().uuid(),
  body: z.string().trim().min(1, "Message cannot be empty.").max(2000),
});

export const replyMessageSchema = z.object({
  body: z.string().trim().min(1, "Reply cannot be empty.").max(2000),
});
