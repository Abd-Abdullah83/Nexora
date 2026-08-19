import { requireAuth } from "@/lib/auth/rbac";
import { getSellerStatus } from "@/lib/sellers/seller.service";
import { AppError, errorResponse } from "@/lib/errors";

export async function GET() {
  try {
    const session = await requireAuth();
    if (!session) throw new AppError("AUTH_REQUIRED");

    // Always looked up by the session's own userId — there is no
    // sellerId-in-query-param variant of this route, specifically so it
    // can never be used to peek at another seller's application status.
    const status = await getSellerStatus(session.userId);

    if (!status) {
      return Response.json({ seller: null, message: "No seller application found." });
    }

    return Response.json({ seller: status });
  } catch (error) {
    return errorResponse(error);
  }
}
