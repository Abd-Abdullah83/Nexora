import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { uploadStoreAsset, deleteImageAsset } from "@/lib/storage/upload";
import { getClientIp, rateLimit } from "@/lib/security/rate-limit";
import { AppError, errorResponse } from "@/lib/errors";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

async function getActiveSellerWithStore(userId: string) {
  const seller = await prisma.seller.findUnique({
    where: { userId },
    select: { id: true, status: true, store: { select: { id: true, logoPublicId: true, bannerPublicId: true } } },
  });
  if (!seller) throw new AppError("VALIDATION_ERROR", { seller: "Seller account not found." });
  if (seller.status !== "active") throw new AppError("ADMIN_UNAUTHORISED");
  if (!seller.store) throw new AppError("VALIDATION_ERROR", { store: "Store not set up yet." });
  return seller;
}

// ── POST /api/sellers/store/upload ─────────────────────────────────────────
// multipart/form-data: file, kind ("logo" | "banner")
export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  try {
    const session = await getSession();
    if (!session) throw new AppError("AUTH_REQUIRED");

    const { allowed } = await rateLimit(`store-asset-upload:${session.userId}`, 20, 60);
    if (!allowed) throw new AppError("RATE_LIMIT_EXCEEDED");

    const seller = await getActiveSellerWithStore(session.userId);

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const kind = formData.get("kind") as string | null;

    if (!file) throw new AppError("VALIDATION_ERROR", { file: "No file provided." });
    if (kind !== "logo" && kind !== "banner") {
      throw new AppError("VALIDATION_ERROR", { kind: "kind must be 'logo' or 'banner'." });
    }
    if (!ALLOWED_TYPES.includes(file.type)) throw new AppError("UPLOAD_INVALID_TYPE");
    if (file.size > MAX_BYTES) throw new AppError("UPLOAD_TOO_LARGE");

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadStoreAsset(buffer, seller.id, kind);

    // Delete the old asset AFTER the new one succeeds — never lose the
    // previous image if the new upload fails partway through.
    const oldPublicId = kind === "logo" ? seller.store!.logoPublicId : seller.store!.bannerPublicId;
    if (oldPublicId) {
      await deleteImageAsset(oldPublicId).catch(() => {
        // Non-fatal — an orphaned old asset is a minor cleanup issue,
        // not worth failing the seller's successful new upload over.
      });
    }

    const updated = await prisma.store.update({
      where: { sellerId: seller.id },
      data:
        kind === "logo"
          ? { logoUrl: result.url, logoPublicId: result.publicId }
          : { bannerUrl: result.url, bannerPublicId: result.publicId },
      select: { id: true, logoUrl: true, bannerUrl: true },
    });

    return Response.json({ store: updated, kind });
  } catch (error) {
    return errorResponse(error);
  }
}

// ── DELETE /api/sellers/store/upload?kind=logo|banner ─────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) throw new AppError("AUTH_REQUIRED");

    const seller = await getActiveSellerWithStore(session.userId);

    const { searchParams } = new URL(req.url);
    const kind = searchParams.get("kind");
    if (kind !== "logo" && kind !== "banner") {
      throw new AppError("VALIDATION_ERROR", { kind: "kind must be 'logo' or 'banner'." });
    }

    const oldPublicId = kind === "logo" ? seller.store!.logoPublicId : seller.store!.bannerPublicId;
    if (oldPublicId) {
      await deleteImageAsset(oldPublicId).catch(() => {});
    }

    const updated = await prisma.store.update({
      where: { sellerId: seller.id },
      data:
        kind === "logo"
          ? { logoUrl: null, logoPublicId: null }
          : { bannerUrl: null, bannerPublicId: null },
      select: { id: true, logoUrl: true, bannerUrl: true },
    });

    return Response.json({ store: updated, kind });
  } catch (error) {
    return errorResponse(error);
  }
}
