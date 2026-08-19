// app/api/admin/appeals/[id]/reply/route.ts
// POST — admin replies to a seller's appeal

import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/rbac";
import { adminReplyToAppeal } from "@/lib/sellers/appeal.service";
import { AppError, errorResponse } from "@/lib/errors";
import { z } from "zod";

const replySchema = z.object({
  body: z.string().trim().min(5, "Message must be at least 5 characters.").max(3000),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAdmin();
    if (!session) throw new AppError("ADMIN_UNAUTHORISED");

    const body = await req.json().catch(() => ({}));
    const parsed = replySchema.safeParse(body);
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", parsed.error.flatten().fieldErrors);

    const message = await adminReplyToAppeal({
      appealId: params.id,
      adminUserId: session.userId,
      body: parsed.data.body,
    });

    return Response.json({ message }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
