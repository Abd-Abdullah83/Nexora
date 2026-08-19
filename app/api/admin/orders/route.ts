import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { AppError, errorResponse } from "@/lib/errors";

// GET /api/admin/orders?status=pending&page=1
export async function GET(req: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) throw new AppError("ADMIN_UNAUTHORISED");

    const params = req.nextUrl.searchParams;
    const status = params.get("status");
    const page = Number(params.get("page") ?? 1);
    const pageSize = 20;

    const where = status ? { status: status as any } : {};

    const [items, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: { user: { select: { fullName: true, email: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.order.count({ where }),
    ]);

    return Response.json({
      items: items.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        paymentStatus: o.paymentStatus,
        total: Number(o.total),
        currency: o.currency,
        createdAt: o.createdAt,
        user: o.user,
      })),
      total,
      page,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
