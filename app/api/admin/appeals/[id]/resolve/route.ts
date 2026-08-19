// app/api/admin/appeals/[id]/resolve/route.ts
// POST — admin issues a final ruling: uphold (stays banned/suspended) or
// lift (calls reinstateSeller() internally)

import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/rbac";
import { resolveAppeal } from "@/lib/sellers/appeal.service";
import { AppError, errorResponse } from "@/lib/errors";
import { z } from "zod";

const resolveSchema = z.object({
  outcome: z.enum(["uphold", "lift"]),
  resolutionNote: z
    .string()
    .trim()
    .min(10, "Resolution note must be at least 10 characters — explain your decision.")
    .max(1000),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAdmin();
    if (!session) throw new AppError("ADMIN_UNAUTHORISED");

    const body = await req.json().catch(() => ({}));
    const parsed = resolveSchema.safeParse(body);
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", parsed.error.flatten().fieldErrors);

    const result = await resolveAppeal({
      appealId: params.id,
      adminUserId: session.userId,
      outcome: parsed.data.outcome,
      resolutionNote: parsed.data.resolutionNote,
    });

    return Response.json({
      result,
      message:
        parsed.data.outcome === "lift"
          ? "Appeal approved — seller has been reinstated."
          : "Appeal resolved — original decision upheld.",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
