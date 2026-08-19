import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/rbac";
import { rejectListing } from "@/lib/sellers/listing-approval.service";
import { AppError, errorResponse } from "@/lib/errors";
import { z } from "zod";

const rejectSchema = z.object({
  reason: z.string().trim().min(10, "Please provide a reason of at least 10 characters.").max(1000),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    if (!session) throw new AppError("ADMIN_UNAUTHORISED");

    const body = await req.json();
    const parsed = rejectSchema.safeParse(body);
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", parsed.error.flatten());

    const product = await rejectListing(params.id, session.userId, parsed.data.reason);
    return Response.json({ product });
  } catch (error) {
    return errorResponse(error);
  }
}
