import { z } from "zod";

// Pakistani mobile number: optional +92 / 0092 / leading 0, then 3XXXXXXXXX
// (10 digits starting with 3, per all major Pakistani mobile prefixes).
const PK_PHONE_REGEX = /^(\+92|0092|0)?3\d{9}$/;

export const sellerApplySchema = z.object({
  sellerType: z.enum(["individual", "business"], {
    errorMap: () => ({ message: "Seller type must be 'individual' or 'business'." }),
  }),
  displayName: z
    .string()
    .min(2, "Store display name must be at least 2 characters.")
    .max(100, "Store display name must be 100 characters or less."),
  businessEmail: z.string().email("Please enter a valid business email address.").toLowerCase(),
  businessPhone: z
    .string()
    .regex(PK_PHONE_REGEX, "Please enter a valid Pakistani mobile number, e.g. 03001234567."),
  agreeToTerms: z.literal(true, {
    errorMap: () => ({ message: "You must agree to the Seller Terms to continue." }),
  }),
});

export const sellerVerifyEmailSchema = z.object({
  token: z.string().min(1, "Verification token is required."),
});

export const sellerRequestOtpSchema = z.object({
  phone: z
    .string()
    .regex(PK_PHONE_REGEX, "Please enter a valid Pakistani mobile number, e.g. 03001234567."),
});

export const sellerVerifyOtpSchema = z.object({
  phone: z
    .string()
    .regex(PK_PHONE_REGEX, "Please enter a valid Pakistani mobile number, e.g. 03001234567."),
  code: z.string().length(6, "OTP must be 6 digits.").regex(/^\d+$/, "OTP must be numeric."),
});
