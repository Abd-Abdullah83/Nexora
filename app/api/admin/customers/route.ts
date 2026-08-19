import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { AppError, errorResponse } from "@/lib/errors";

// GET /api/admin/customers?q=search&page=1
export async function GET(req: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) throw new AppError("ADMIN_UNAUTHORISED");

    const params = req.nextUrl.searchParams;
    const q = params.get("q")?.trim();
    const page = Number(params.get("page") ?? 1);
    const pageSize = 20;

    const where: any = { role: "customer", deletedAt: null };
    if (q) {
      where.OR = [
        { fullName: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { username: { contains: q, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          fullName: true,
          email: true,
          username: true,
          emailVerified: true,
          createdAt: true,
          _count: { select: { orders: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.user.count({ where }),
    ]);

    return Response.json({
      items,
      total,
      page,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
