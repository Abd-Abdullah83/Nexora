import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/rbac";
import { forceArchiveListing, forceReactivateListing } from "@/lib/admin/overrides.service";
import {
  listingForceArchiveSchema,
  listingForceReactivateSchema,
} from "@/lib/validation/override";
import { AppError, errorResponse } from "@/lib/errors";

// POST /api/admin/overrides/listing/[id]?action=archive|reactivate
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAdmin();
    if (!session) throw new AppError("ADMIN_UNAUTHORISED");

    const action = new URL(req.url).searchParams.get("action");
    if (!action || !["archive", "reactivate"].includes(action)) {
      throw new AppError("VALIDATION_ERROR", {
        action: "action query param must be 'archive' or 'reactivate'.",
      });
    }

    const body = await req.json().catch(() => ({}));

    if (action === "archive") {
      const parsed = listingForceArchiveSchema.safeParse(body);
      if (!parsed.success) throw new AppError("VALIDATION_ERROR", parsed.error.flatten().fieldErrors);
      const result = await forceArchiveListing({
        productId: params.id,
        adminId: session.userId,
        reason: parsed.data.reason,
      });
      return Response.json({ ...result, message: "Listing force-archived." });
    } else {
      const parsed = listingForceReactivateSchema.safeParse(body);
      if (!parsed.success) throw new AppError("VALIDATION_ERROR", parsed.error.flatten().fieldErrors);
      const result = await forceReactivateListing({
        productId: params.id,
        adminId: session.userId,
        reason: parsed.data.reason,
      });
      return Response.json({ ...result, message: "Listing force-reactivated." });
    }
  } catch (error) {
    return errorResponse(error);
  }
}
