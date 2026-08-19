import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/rbac";
import { deleteCategoryAttribute } from "@/lib/repositories/variant.repository";
import { logAuditEvent } from "@/lib/audit";
import { getClientIp } from "@/lib/security/rate-limit";
import { AppError, errorResponse } from "@/lib/errors";

interface RouteParams {
  params: { id: string; attributeId: string };
}

// DELETE /api/admin/categories/[id]/attributes/[attributeId]
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const ip = getClientIp(req.headers);

  try {
    const session = await requireAdmin();
    if (!session) throw new AppError("ADMIN_UNAUTHORISED");

    await deleteCategoryAttribute(params.attributeId);

    await logAuditEvent({
      userId: session.userId,
      action: "category_attribute.delete",
      resourceType: "category",
      resourceId: params.id,
      oldValues: { attributeId: params.attributeId },
      ipAddress: ip,
      userAgent: req.headers.get("user-agent"),
    });

    return Response.json({ message: "Attribute removed." });
  } catch (error) {
    return errorResponse(error);
  }
}
