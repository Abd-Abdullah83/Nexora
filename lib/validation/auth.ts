import { z } from "zod";

export const registerSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters.").max(150),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters.")
    .max(30, "Username must be 30 characters or less.")
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores.")
    .toLowerCase(),
  email: z.string().email("Please enter a valid email address.").toLowerCase(),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export const loginSchema = z.object({
  emailOrUsername: z.string().min(1, "Email or username is required.").toLowerCase(),
  password: z.string().min(1, "Password is required."),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address.").toLowerCase(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1, "Verification token is required."),
});

export const totpSetupVerifySchema = z.object({
  code: z.string().length(6, "Authenticator code must be 6 digits."),
});

export const totpLoginVerifySchema = z.object({
  email: z.string().email().toLowerCase(),
  code: z.string().length(6, "Authenticator code must be 6 digits."),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
