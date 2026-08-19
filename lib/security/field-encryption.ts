// ─────────────────────────────────────────────────────────────────────────
// lib/security/field-encryption.ts
//
// AES-256-GCM field-level encryption for sensitive data at rest —
// specifically bank account numbers and routing codes (Phase 8).
//
// Per the scaling doc's Phase 8 Security Review: "Bank account numbers
// are never persisted as plaintext... provider tokenization or, at
// minimum, strong field-level encryption with restricted key access."
// No payout provider is integrated yet (same honest gap as Phase 4's
// billing gateway and Phase 7's payment gateway — see CODEBASE_AUDIT.md),
// so provider tokenization isn't available. UNLIKE those two gaps,
// though, field-level encryption needs no external business
// relationship or compliance lead time — it's pure application code —
// so rather than leave another "ENCRYPT AT REST before production"
// comment as a permanent TODO, this is built as a real, working
// implementation now.
//
// ── Key management ──────────────────────────────────────────────────────
// Requires FIELD_ENCRYPTION_KEY in .env — a 32-byte key, base64-encoded.
// Generate one with:
//   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
//
// "Restricted key access" (per the doc) means: this key lives only in
// your server's environment variables, never in the database, never in
// client-side code, never logged. Anyone with read access to your
// production .env effectively has read access to bank account numbers —
// treat it with the same care as AUTH_SECRET or your database password.
//
// Rotating this key: there is no built-in re-encryption/versioning here
// (out of scope for this phase) — rotating it would make all existing
// encrypted values undecryptable. If you need key rotation, that's a
// real migration task (decrypt all rows with the old key, re-encrypt
// with the new one, in one transaction) — flagging this now rather than
// pretending it's a solved problem.
// ─────────────────────────────────────────────────────────────────────────

import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // recommended length for GCM

function getKey(): Buffer {
  const keyB64 = process.env.FIELD_ENCRYPTION_KEY;
  if (!keyB64) {
    throw new Error(
      "FIELD_ENCRYPTION_KEY is not set. Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\" and add it to .env."
    );
  }
  const key = Buffer.from(keyB64, "base64");
  if (key.length !== 32) {
    throw new Error("FIELD_ENCRYPTION_KEY must decode to exactly 32 bytes (AES-256). Regenerate it with the command above.");
  }
  return key;
}

/**
 * Encrypts a plaintext string. Returns a single string combining
 * iv:authTag:ciphertext (all base64), safe to store directly in a TEXT
 * column. Each call uses a fresh random IV, so encrypting the same
 * value twice produces different output — this is correct and expected
 * for GCM, not a bug.
 */
export function encryptField(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv.toString("base64"), authTag.toString("base64"), encrypted.toString("base64")].join(":");
}

/**
 * Decrypts a string produced by encryptField(). Throws if the value was
 * tampered with (GCM's auth tag check fails) or the key is wrong —
 * never silently returns garbage.
 */
export function decryptField(stored: string): string {
  const key = getKey();
  const [ivB64, authTagB64, dataB64] = stored.split(":");
  if (!ivB64 || !authTagB64 || !dataB64) {
    throw new Error("Malformed encrypted field value — expected iv:authTag:ciphertext format.");
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
