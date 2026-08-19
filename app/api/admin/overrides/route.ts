import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { AppError, errorResponse } from "@/lib/errors";

// GET /api/admin/overrides
// Supports ?resourceType=order|escrow_hold|listing&page=&pageSize=
export async function GET(req: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) throw new AppError("ADMIN_UNAUTHORISED");

    const { searchParams } = req.nextUrl;
    const resourceType = searchParams.get("resourceType");
    const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const pageSize = Math.min(50, Math.max(1, Number(searchParams.get("pageSize") ?? "25")));
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (resourceType && resourceType !== "all") {
      where.resourceType = resourceType;
    }

    const [total, items] = await Promise.all([
      prisma.adminOverride.count({ where }),
      prisma.adminOverride.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        include: {
          admin: { select: { fullName: true, email: true } },
        },
      }),
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
