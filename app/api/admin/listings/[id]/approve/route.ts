import { requireAdmin } from "@/lib/auth/rbac";
import { approveListing } from "@/lib/sellers/listing-approval.service";
import { AppError, errorResponse } from "@/lib/errors";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    if (!session) throw new AppError("ADMIN_UNAUTHORISED");

    const product = await approveListing(params.id, session.userId);
    return Response.json({ product });
  } catch (error) {
    return errorResponse(error);
  }
}
