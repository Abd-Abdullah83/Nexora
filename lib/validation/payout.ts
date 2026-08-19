// lib/validation/payout.ts

import { z } from "zod";

// Minimum payout threshold — prevents micro-payouts that cost more to
// process than they're worth, and gives the seller a sensible default
// expectation. PKR 500 is roughly USD 1.80 at current rates — a very
// low bar, which is intentional at this stage of the marketplace.
export const MIN_PAYOUT_AMOUNT = 500;

// ── Seller: request a payout ──────────────────────────────────────────────
export const payoutRequestSchema = z.object({
  amount: z
    .number()
    .positive("Amount must be greater than zero.")
    .min(MIN_PAYOUT_AMOUNT, `Minimum payout is PKR ${MIN_PAYOUT_AMOUNT}.`),
  // Currency is always derived from the wallet, never the request —
  // this field is just for explicit acknowledgement/future use.
  currency: z.string().length(3).default("PKR"),
  // Optional note from the seller (e.g. "Q2 payout")
  note: z.string().trim().max(200).optional(),
});

// ── Seller: save/update bank account ──────────────────────────────────────
export const bankAccountSchema = z.object({
  accountHolderName: z.string().trim().min(2).max(200),
  bankName: z.string().trim().min(2).max(200),
  // Account number: Zod validates format constraints; application layer
  // is responsible for encryption before storage (see PHASE_8_NOTES.md).
  accountNumber: z
    .string()
    .trim()
    .min(8, "Account number must be at least 8 characters.")
    .max(34, "Account number too long — enter without spaces."),
  routingCode: z.string().trim().max(40).optional().nullable(),
  accountType: z.enum(["current", "savings"]).default("current"),
});

// ── Admin: process / mark paid / fail ─────────────────────────────────────
export const adminPayoutActionSchema = z.object({
  // Required when marking failed — shown to the seller in their history.
  adminNote: z.string().trim().max(500).optional(),
});

export type PayoutRequestInput = z.infer<typeof payoutRequestSchema>;
export type BankAccountInput = z.infer<typeof bankAccountSchema>;
export type AdminPayoutActionInput = z.infer<typeof adminPayoutActionSchema>;
