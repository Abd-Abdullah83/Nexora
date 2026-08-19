import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { auditLogQuerySchema } from "@/lib/validation/override";
import { AppError, errorResponse } from "@/lib/errors";

// GET /api/admin/audit-log
// Filterable, paginated audit trail across all domains.
// Supports ?action=&resourceType=&userId=&from=&to=&page=&pageSize=

export async function GET(req: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) throw new AppError("ADMIN_UNAUTHORISED");

    const { searchParams } = new URL(req.url);
    const parsed = auditLogQuerySchema.safeParse({
      action:       searchParams.get("action")       ?? undefined,
      resourceType: searchParams.get("resourceType") ?? undefined,
      userId:       searchParams.get("userId")       ?? undefined,
      from:         searchParams.get("from")         ?? undefined,
      to:           searchParams.get("to")           ?? undefined,
      page:         searchParams.get("page")         ?? "1",
      pageSize:     searchParams.get("pageSize")     ?? "50",
    });

    if (!parsed.success) {
      throw new AppError("VALIDATION_ERROR", parsed.error.flatten().fieldErrors);
    }

    const { action, resourceType, userId, from, to, page, pageSize } = parsed.data;

    const where = {
      ...(action       ? { action: { contains: action, mode: "insensitive" as const } } : {}),
      ...(resourceType ? { resourceType } : {}),
      ...(userId       ? { userId } : {}),
      ...(from || to   ? {
        createdAt: {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to   ? { lte: new Date(to)   } : {}),
        },
      } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: { select: { fullName: true, email: true, role: true } },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return Response.json({
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
