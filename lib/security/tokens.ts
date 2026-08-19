import { randomBytes } from "crypto";

/**
 * Generates a cryptographically secure random token (hex string).
 * Used for email verification and password reset — single-use, time-limited.
 */
export function generateSecureToken(bytes = 32): string {
  return randomBytes(bytes).toString("hex");
}

export function hoursFromNow(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

export function minutesFromNow(minutes: number): Date {
  return new Date(Date.now() + minutes * 60 * 1000);
}

export function isExpired(expiry: Date | null): boolean {
  if (!expiry) return true;
  return new Date() > expiry;
}
