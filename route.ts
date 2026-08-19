import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { logAuditEvent } from "@/lib/audit";
import { getClientIp } from "@/lib/security/rate-limit";
import { AppError, errorResponse } from "@/lib/errors";
import { z } from "zod";

const moderateSchema = z.object({
  status: z.enum(["approved", "rejected", "flagged"]),
  note: z.string().max(500).optional(),
});

// GET /api/admin/reviews — list reviews with filter
export async function GET(req: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) throw new AppError("ADMIN_UNAUTHORISED");

    const params = req.nextUrl.searchParams;
    const status = params.get("status") ?? "pending";
    const page = Number(params.get("page") ?? 1);
    const pageSize = 20;

    const where = status === "all" ? {} : { status: status as any };

    const [items, total] = await Promise.all([
      prisma.review.findMany({
        where,
        include: {
          user: { select: { fullName: true, email: true } },
          product: { select: { name: true, slug: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.review.count({ where }),
    ]);

    return Response.json({ items, total, page, totalPages: Math.ceil(total / pageSize) });
  } catch (error) {
    return errorResponse(error);
  }
}

// PATCH /api/admin/reviews/[id] — approve/reject/flag
export async function PATCH(req: NextRequest) {
  const ip = getClientIp(req.headers);
  try {
    const session = await requireAdmin();
    if (!session) throw new AppError("ADMIN_UNAUTHORISED");

    const id = req.nextUrl.searchParams.get("id");
    if (!id) throw new AppError("VALIDATION_ERROR", { id: "Review ID required." });

    const body = await req.json();
    const parsed = moderateSchema.safeParse(body);
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", parsed.error.flatten());

    const { status } = parsed.data;

    const review = await prisma.review.update({
      where: { id },
      data: {
        status,
        moderatedById: session.userId,
        moderatedAt: new Date(),
      },
    });

    await logAuditEvent({
      userId: session.userId,
      action: `review.${status}`,
      resourceType: "review",
      resourceId: id,
      newValues: { status },
      ipAddress: ip,
      userAgent: req.headers.get("user-agent"),
    });

    return Response.json({ review });
  } catch (error) {
    return errorResponse(error);
  }
}