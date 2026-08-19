import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/rbac";
import {
  getCategoryAttributes,
  createCategoryAttribute,
} from "@/lib/repositories/variant.repository";
import { createCategoryAttributeSchema } from "@/lib/validation/variant";
import { logAuditEvent } from "@/lib/audit";
import { getClientIp } from "@/lib/security/rate-limit";
import { AppError, errorResponse } from "@/lib/errors";

interface RouteParams {
  params: { id: string };
}

// GET /api/admin/categories/[id]/attributes
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireAdmin();
    if (!session) throw new AppError("ADMIN_UNAUTHORISED");

    const attributes = await getCategoryAttributes(params.id);
    return Response.json({ attributes });
  } catch (error) {
    return errorResponse(error);
  }
}

// POST /api/admin/categories/[id]/attributes
// body: { name, key, type, options, unit?, isRequired, displayOrder }
export async function POST(req: NextRequest, { params }: RouteParams) {
  const ip = getClientIp(req.headers);

  try {
    const session = await requireAdmin();
    if (!session) throw new AppError("ADMIN_UNAUTHORISED");

    const body = await req.json();
    const parsed = createCategoryAttributeSchema.safeParse({
      ...body,
      categoryId: params.id,
    });
    if (!parsed.success) {
      throw new AppError("VALIDATION_ERROR", parsed.error.flatten());
    }

    const attribute = await createCategoryAttribute(parsed.data);

    await logAuditEvent({
      userId: session.userId,
      action: "category_attribute.create",
      resourceType: "category",
      resourceId: params.id,
      newValues: attribute,
      ipAddress: ip,
      userAgent: req.headers.get("user-agent"),
    });

    return Response.json({ attribute }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
