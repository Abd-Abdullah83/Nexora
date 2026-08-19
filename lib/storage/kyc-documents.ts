import { v2 as cloudinary } from "cloudinary";

/**
 * lib/storage/kyc-documents.ts
 *
 * Document storage for Phase 3 KYC/KYB uploads — deliberately SEPARATE
 * from lib/storage/cloudinary.ts / upload.ts (product images), which use
 * Cloudinary's standard PUBLIC delivery. That's correct for product
 * photos and wrong for ID documents.
 *
 * Per the scaling doc's Phase 3 Security Review: "stored encrypted at
 * rest and access-controlled (signed, short-lived URLs — never public
 * buckets)" and the acceptance criteria "a direct unauthenticated URL
 * request fails." This file uploads with `type: "authenticated"`
 * (Cloudinary's private delivery mode — assets are not servable by a
 * bare public URL at all) and only ever returns a signed URL with a
 * short expiry, generated on demand at view time.
 *
 * Reuses the same CLOUDINARY_* env vars and cloud account as the existing
 * product-image storage — same account, different delivery type per
 * asset, which is how Cloudinary is designed to be used for this exact
 * "some assets public, some private" scenario.
 */

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB — ID scans/PDFs are larger than product thumbnails

// Magic-byte signatures. Same defense-in-depth principle as
// lib/storage/cloudinary.ts's validateImageFile() — never trust a
// client-supplied MIME type or file extension alone. PDFs are accepted
// here (unlike the product-image validator) since business registration/
// trade license/tax documents are commonly issued as PDFs, not photos.
const SIGNATURES: Array<{ bytes: number[]; mime: string }> = [
  { bytes: [0xff, 0xd8, 0xff], mime: "image/jpeg" },
  { bytes: [0x89, 0x50, 0x4e, 0x47], mime: "image/png" },
  { bytes: [0x25, 0x50, 0x44, 0x46], mime: "application/pdf" }, // "%PDF"
  // WEBP: "RIFF"....″WEBP" — signature spans two non-contiguous ranges,
  // checked separately below rather than via the simple prefix table.
];

export interface DocValidationResult {
  valid: boolean;
  mime?: string;
  reason?: string;
}

/**
 * Validates file type via magic bytes (not extension/MIME header, which
 * are client-supplied and trivially spoofable) and enforces a size cap.
 *
 * NOTE on "scans for malicious payloads" (Phase 3 Security Review): this
 * function validates that the file IS a well-formed image or PDF of the
 * claimed type. It does NOT run antivirus/malware scanning — that needs a
 * real scanning service (e.g. ClamAV, a cloud AV API) which isn't wired
 * up anywhere in this codebase yet. Documented here as an honest residual
 * gap, the same way the SMS provider was left as an explicit stub in
 * Phase 2, rather than silently claiming more coverage than this actually
 * provides.
 */
export function validateKycDocument(buffer: Buffer): DocValidationResult {
  if (buffer.length === 0) {
    return { valid: false, reason: "File is empty." };
  }
  if (buffer.length > MAX_FILE_BYTES) {
    return { valid: false, reason: "File exceeds the 10MB size limit." };
  }

  for (const sig of SIGNATURES) {
    if (sig.bytes.every((byte, i) => buffer[i] === byte)) {
      return { valid: true, mime: sig.mime };
    }
  }

  // WEBP: bytes 0-3 "RIFF", bytes 8-11 "WEBP"
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) {
    return { valid: true, mime: "image/webp" };
  }

  return {
    valid: false,
    reason: "Unrecognized file type. Upload a JPEG, PNG, WEBP, or PDF.",
  };
}

/**
 * Uploads a validated document buffer to private (authenticated)
 * Cloudinary storage. Returns ONLY the public_id — never a URL. Per the
 * schema comment on SellerVerification.fileRef, the DB must never store
 * a directly-usable URL for these assets.
 */
export async function uploadKycDocument(
  buffer: Buffer,
  sellerId: string,
  docType: string
): Promise<{ publicId: string }> {
  const base64 = `data:application/octet-stream;base64,${buffer.toString("base64")}`;

  const result = await cloudinary.uploader.upload(base64, {
    folder: `nexora/kyc/${sellerId}`,
    public_id: docType,
    type: "authenticated", // private delivery — not servable via a bare public URL
    overwrite: true, // a re-submission after rejection replaces the prior file
    resource_type: "auto", // images and PDFs both go through this same path
  });

  return { publicId: result.public_id };
}

/**
 * Generates a short-lived signed URL for viewing a private document.
 * Default expiry is 5 minutes — long enough for an admin to open and
 * review one document, short enough that a leaked/logged link goes stale
 * quickly. Call this fresh every time a document needs to be viewed;
 * never persist the URL itself anywhere (DB, logs, client state beyond
 * the single render).
 */
export function getSignedKycDocumentUrl(
  publicId: string,
  expiresInSeconds = 300
): string {
  const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;

  return cloudinary.utils.private_download_url(publicId, "", {
    type: "authenticated",
    resource_type: "image", // Cloudinary's private_download_url defaults to "image"; PDFs uploaded via resource_type:"auto" are still served correctly under this for authenticated delivery
    expires_at: expiresAt,
  });
}

export async function deleteKycDocument(publicId: string): Promise<void> {
  await cloudinary.uploader.destroy(publicId, { type: "authenticated" });
}
