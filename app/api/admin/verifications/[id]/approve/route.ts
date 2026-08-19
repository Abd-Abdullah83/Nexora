import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/rbac";
import { reviewVerificationDocument } from "@/lib/sellers/verification.service";
import { AppError, errorResponse } from "@/lib/errors";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAdmin();
    if (!session) throw new AppError("ADMIN_UNAUTHORISED");

    const result = await reviewVerificationDocument({
      verificationId: params.id,
      action: "approve",
      reviewerId: session.userId,
    });

    return Response.json({ message: "Document approved.", ...result });
  } catch (error) {
    return errorResponse(error);
  }
}
