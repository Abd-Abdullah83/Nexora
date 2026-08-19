import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

// Magic-byte signatures for the allowed formats. Validating the actual file
// bytes (not just the browser-reported MIME type or filename extension)
// prevents someone from renaming a malicious file to "photo.jpg" and having
// it accepted at face value.
const MAGIC_BYTES: Record<string, number[][]> = {
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  "image/png": [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  "image/webp": [[0x52, 0x49, 0x46, 0x46]], // "RIFF" header; WebP-specific bytes follow at offset 8
};

export interface UploadValidationError {
  code: "UPLOAD_INVALID_TYPE" | "UPLOAD_TOO_LARGE";
}

function matchesSignature(buffer: Buffer, signature: number[]): boolean {
  if (buffer.length < signature.length) return false;
  return signature.every((byte, i) => buffer[i] === byte);
}

export function validateImageFile(
  buffer: Buffer,
  reportedMimeType: string
): UploadValidationError | null {
  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    return { code: "UPLOAD_TOO_LARGE" };
  }

  if (!ALLOWED_MIME_TYPES.includes(reportedMimeType)) {
    return { code: "UPLOAD_INVALID_TYPE" };
  }

  const signatures = MAGIC_BYTES[reportedMimeType];
  const matchesAny = signatures.some((sig) => matchesSignature(buffer, sig));

  if (!matchesAny) {
    // The reported MIME type doesn't match the file's actual binary content
    // — reject rather than trust the browser-supplied content-type header.
    return { code: "UPLOAD_INVALID_TYPE" };
  }

  return null;
}

export async function uploadProductImage(
  buffer: Buffer,
  folder = "products"
): Promise<{ url: string; publicId: string }> {
  const base64 = `data:image/jpeg;base64,${buffer.toString("base64")}`;

  const result = await cloudinary.uploader.upload(base64, {
    folder,
    resource_type: "image",
    // Cloudinary re-encodes on its own infrastructure, which also strips
    // EXIF/metadata and validates the file is genuinely a decodable image —
    // a corrupted or polyglot file will fail here rather than being stored.
    transformation: [{ quality: "auto", fetch_format: "auto" }],
  });

  return { url: result.secure_url, publicId: result.public_id };
}

export async function deleteProductImage(publicId: string): Promise<void> {
  await cloudinary.uploader.destroy(publicId);
}
