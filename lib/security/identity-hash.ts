import { createHmac } from "crypto";

/**
 * lib/security/identity-hash.ts
 *
 * Hashing for seller identity numbers (national ID, passport, business
 * registration, tax ID) — used for future duplicate/ban-evasion checks
 * (Phase 11 reads these; this is where they're first written).
 *
 * WHY NOT bcrypt: every other hash in this codebase (passwords, OTPs) uses
 * bcrypt, which is deliberately slow and includes a random per-call salt —
 * the same input produces a DIFFERENT hash every time. That's correct for
 * "verify this one secret" but wrong here: the whole point of this table
 * is `WHERE hash = ?` duplicate lookups across many sellers, which requires
 * the same identity number to always hash to the same value. HMAC-SHA256
 * with a fixed server-side secret gives that determinism while still
 * making the hash infeasible to reverse or rainbow-table without the
 * secret — "salted" in the sense the scaling doc means it (not the
 * per-record bcrypt sense).
 *
 * KEY SEPARATION: deliberately a different secret from AUTH_SECRET (JWT
 * signing). Reusing a key across unrelated cryptographic purposes is bad
 * practice — if one use case's secret ever leaks or rotates, the other
 * shouldn't be affected.
 */

function getSecret(): string {
  if (process.env.NODE_ENV === "production" && !process.env.IDENTITY_HASH_SECRET) {
    // Loud, not silent — an identity hash generated with the fallback
    // secret today can never be matched against one generated with a real
    // secret after this gets fixed, silently breaking ban-evasion detection
    // with no error anywhere. Better to fail runtime than crash build.
    throw new Error(
      "IDENTITY_HASH_SECRET must be set in production. Generate one with: openssl rand -hex 32"
    );
  }
  return process.env.IDENTITY_HASH_SECRET || "dev-only-identity-hash-secret-change-me";
}

/**
 * Normalizes an identity number before hashing so the same real-world
 * document doesn't hash differently due to formatting variance — e.g.
 * Pakistani national IDs are commonly written both "12345-6789012-3" and
 * "1234567890123". Without this, duplicate detection silently misses
 * variants of the same number, which defeats the entire point of this
 * table (flagged explicitly in the scaling doc for Phase 11, but the
 * normalization has to happen consistently starting here in Phase 3,
 * where the hash is first written).
 */
export function normalizeIdentityValue(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[\s\-_/.]/g, ""); // strip whitespace, dashes, underscores, slashes, dots
}

export function hashIdentityValue(raw: string): string {
  const normalized = normalizeIdentityValue(raw);
  return createHmac("sha256", getSecret()).update(normalized).digest("hex");
}
