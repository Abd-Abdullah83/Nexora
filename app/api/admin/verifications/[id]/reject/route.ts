import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/rbac";
import { reviewVerificationDocument } from "@/lib/sellers/verification.service";
import { reviewVerificationSchema } from "@/lib/validation/seller-verification";
import { AppError, errorResponse } from "@/lib/errors";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAdmin();
    if (!session) throw new AppError("ADMIN_UNAUTHORISED");

    const body = await req.json().catch(() => ({}));
    const parsed = reviewVerificationSchema.safeParse(body);
    if (!parsed.success || !parsed.data.rejectionReason) {
      throw new AppError("VALIDATION_ERROR", { rejectionReason: "A reason is required when rejecting a document." });
    }

    const result = await reviewVerificationDocument({
      verificationId: params.id,
      action: "reject",
      reviewerId: session.userId,
      rejectionReason: parsed.data.rejectionReason,
    });

    return Response.json({ message: "Document rejected.", ...result });
  } catch (error) {
    return errorResponse(error);
  }
}
