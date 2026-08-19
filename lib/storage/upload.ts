// lib/storage/upload.ts
//
// GAP FIX: added a generic uploadImage() helper plus uploadStoreAsset()
// for seller store logo/banner uploads (previously store customization
// only accepted a pasted external URL — sellers now get a native upload
// widget backed by the same Cloudinary account already used for product
// images). uploadProductImage()'s external signature and behavior are
// UNCHANGED — it now just calls the generic helper internally, so no
// other file that imports uploadProductImage needs to change.

import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

export interface UploadResult {
  publicId: string;
  url: string;
  thumbUrl: string;
  width: number;
  height: number;
}

interface UploadOptions {
  folder: string;
  maxWidth: number;
  thumbWidth?: number;
}

// ── Generic upload — used by both product images and store assets ────────
async function uploadImage(buffer: Buffer, options: UploadOptions): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: options.folder,
        resource_type: "image",
        transformation: [
          {
            width: options.maxWidth,
            crop: "limit",
            quality: "auto",
            fetch_format: "auto",
          },
        ],
      },
      (error, result) => {
        if (error || !result) {
          return reject(error ?? new Error("Cloudinary upload failed"));
        }

        const thumbUrl = cloudinary.url(result.public_id, {
          width: options.thumbWidth ?? 400,
          crop: "limit",
          quality: "auto",
          fetch_format: "auto",
          secure: true,
        });

        resolve({
          publicId: result.public_id,
          url: result.secure_url,
          thumbUrl,
          width: result.width,
          height: result.height,
        });
      }
    );

    stream.end(buffer);
  });
}

// ── Product images — unchanged external behavior ──────────────────────────
export async function uploadProductImage(buffer: Buffer): Promise<UploadResult> {
  return uploadImage(buffer, { folder: "nexora/products", maxWidth: 1200, thumbWidth: 400 });
}

export async function deleteProductImage(publicId: string): Promise<void> {
  await cloudinary.uploader.destroy(publicId);
}

// ── Store assets (logo / banner) — GAP FIX ────────────────────────────────
// Separate folder per seller so a seller's assets are easy to find/audit
// in the Cloudinary media library, and separate max widths since a banner
// is wide/short while a logo is roughly square.
export async function uploadStoreAsset(
  buffer: Buffer,
  sellerId: string,
  kind: "logo" | "banner"
): Promise<UploadResult> {
  const maxWidth = kind === "banner" ? 1600 : 600;
  const thumbWidth = kind === "banner" ? 800 : 200;
  return uploadImage(buffer, {
    folder: `nexora/stores/${sellerId}`,
    maxWidth,
    thumbWidth,
  });
}

// Alias so store-asset call sites don't have to import something named
// "deleteProductImage" for a non-product delete — same underlying
// Cloudinary destroy call, just a name that matches what it's used for.
export const deleteImageAsset = deleteProductImage;
