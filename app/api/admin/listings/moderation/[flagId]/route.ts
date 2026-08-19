import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/rbac";
import { resolveModerationFlag } from "@/lib/sellers/listing-moderation.service";
import { AppError, errorResponse } from "@/lib/errors";
import { z } from "zod";

const schema = z.object({
  action: z.enum(["clear", "reject"]),
  note: z.string().max(1000).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { flagId: string } }
) {
  try {
    const session = await requireAdmin();
    if (!session) throw new AppError("ADMIN_UNAUTHORISED");

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", parsed.error.flatten());

    const result = await resolveModerationFlag({
      flagId: params.flagId,
      action: parsed.data.action,
      adminUserId: session.userId,
      note: parsed.data.note,
    });

    return Response.json({ result });
  } catch (error) {
    return errorResponse(error);
  }
}
