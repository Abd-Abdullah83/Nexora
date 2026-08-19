import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/rbac";
import { resolveCategoryRequest } from "@/lib/admin/category-request.service";
import { resolveCategoryRequestSchema } from "@/lib/validation/category-request";
import { getClientIp, rateLimit } from "@/lib/security/rate-limit";
import { AppError, errorResponse } from "@/lib/errors";

interface RouteParams {
  params: { id: string };
}

// ── PATCH /api/admin/category-requests/[id] ───────────────────────────────
// body: { action: "approve" | "reject", note?, displayOrder? }
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const ip = getClientIp(req.headers);
  try {
    const session = await requireAdmin();
    if (!session) throw new AppError("ADMIN_UNAUTHORISED");

    const { allowed } = await rateLimit(`category-request-resolve:${session.userId}`, 30, 60);
    if (!allowed) throw new AppError("RATE_LIMIT_EXCEEDED");

    const body = await req.json();
    const parsed = resolveCategoryRequestSchema.safeParse(body);
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", parsed.error.flatten());

    const result = await resolveCategoryRequest({
      requestId: params.id,
      adminUserId: session.userId,
      input: parsed.data,
    });

    return Response.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
