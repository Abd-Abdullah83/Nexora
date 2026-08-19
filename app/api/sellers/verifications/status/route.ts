import { requireAuth } from "@/lib/auth/rbac";
import { getVerificationStatus } from "@/lib/sellers/verification.service";
import { AppError, errorResponse } from "@/lib/errors";

export async function GET() {
  try {
    const session = await requireAuth();
    if (!session) throw new AppError("AUTH_REQUIRED");

    // Looked up by the session's own userId only — there is no
    // sellerId-in-query-param variant, so this can never be used to view
    // another seller's verification status.
    const status = await getVerificationStatus(session.userId);

    if (!status) {
      return Response.json({ seller: null, message: "No seller application found." });
    }

    return Response.json({ seller: status });
  } catch (error) {
    return errorResponse(error);
  }
}
