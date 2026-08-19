import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/rbac";
import { grantSellerTrust, revokeSellerTrust } from "@/lib/sellers/listing-approval.service";
import { AppError, errorResponse } from "@/lib/errors";
import { z } from "zod";

const trustActionSchema = z.object({
  action: z.enum(["grant", "revoke"]),
  reason: z.string().trim().max(1000).optional(),
});

// POST /api/admin/sellers/[id]/trust
// body: { action: "grant" | "revoke", reason?: string }
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    if (!session) throw new AppError("ADMIN_UNAUTHORISED");

    const body = await req.json();
    const parsed = trustActionSchema.safeParse(body);
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", parsed.error.flatten());

    const seller =
      parsed.data.action === "grant"
        ? await grantSellerTrust(params.id, session.userId)
        : await revokeSellerTrust(params.id, session.userId, parsed.data.reason);

    return Response.json({ seller });
  } catch (error) {
    return errorResponse(error);
  }
}
