import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { rateLimit, getClientIp } from "@/lib/security/rate-limit";
import { submitVerificationDocument } from "@/lib/sellers/verification.service";
import { sellerDocTypeSchema } from "@/lib/validation/seller-verification";
import { AppError, errorResponse } from "@/lib/errors";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);

  try {
    const session = await requireAuth();
    if (!session) throw new AppError("AUTH_REQUIRED");

    // Per-account rate limit — document uploads are larger/costlier than
    // most requests this codebase rate-limits; this also bounds how many
    // times a seller can hammer the Cloudinary upload API.
    const { allowed } = await rateLimit(`seller:kyc-upload:${session.userId}`, 20, 3600);
    if (!allowed) {
      throw new AppError("RATE_LIMIT_EXCEEDED", {
        message: "Too many document uploads. Please wait before trying again.",
      });
    }

    // sellerId/sellerType come from the session's own seller record —
    // never trusted from the request body, same rule as every other
    // seller route in this codebase.
    const seller = await prisma.seller.findUnique({
      where: { userId: session.userId },
      select: { id: true, sellerType: true },
    });
    if (!seller) {
      throw new AppError("VALIDATION_ERROR", { seller: "No seller application found for this account." });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const docTypeRaw = formData.get("docType");
    const identityNumberRaw = formData.get("identityNumber");

    if (!file) {
      throw new AppError("VALIDATION_ERROR", { file: "A document file is required." });
    }

    const parsedDocType = sellerDocTypeSchema.safeParse(docTypeRaw);
    if (!parsedDocType.success) {
      throw new AppError("VALIDATION_ERROR", { docType: "A valid document type is required." });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const requirements = await submitVerificationDocument({
      sellerId: seller.id,
      sellerType: seller.sellerType,
      actorUserId: session.userId,
      docType: parsedDocType.data,
      fileBuffer: buffer,
      identityNumber: typeof identityNumberRaw === "string" ? identityNumberRaw : undefined,
    });

    return Response.json({
      message: "Document submitted for review.",
      requirements,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
