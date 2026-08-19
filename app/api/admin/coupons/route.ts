import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { logAuditEvent } from "@/lib/audit";
import { getClientIp } from "@/lib/security/rate-limit";
import { AppError, errorResponse } from "@/lib/errors";
import { z } from "zod";

function getCsrfHeader(req: NextRequest) {
  return req.headers.get("x-csrf-token");
}

const couponSchema = z.object({
  code: z
    .string()
    .min(3, "Code must be at least 3 characters.")
    .max(30)
    .toUpperCase()
    .regex(/^[A-Z0-9_-]+$/, "Code can only contain letters, numbers, dashes and underscores."),
  description: z.string().max(200).optional(),
  discountType: z.enum(["percentage", "fixed_amount"]),
  discountValue: z.number().positive("Discount value must be positive."),
  minOrderAmount: z.number().nonnegative().optional().nullable(),
  maxUses: z.number().int().positive().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  isActive: z.boolean().default(true),
});

// GET /api/admin/coupons — list all coupons
export async function GET(req: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) throw new AppError("ADMIN_UNAUTHORISED");

    const coupons = await prisma.coupon.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { orders: true } } },
    });

    return Response.json({ coupons });
  } catch (error) {
    return errorResponse(error);
  }
}

// POST /api/admin/coupons — create coupon
export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  try {
    const session = await requireAdmin();
    if (!session) throw new AppError("ADMIN_UNAUTHORISED");

    const body = await req.json();
    const parsed = couponSchema.safeParse(body);
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", parsed.error.flatten());

    const existing = await prisma.coupon.findUnique({ where: { code: parsed.data.code } });
    if (existing) throw new AppError("VALIDATION_ERROR", { code: "This coupon code already exists." });

    const coupon = await prisma.coupon.create({
      data: {
        code: parsed.data.code,
        description: parsed.data.description,
        discountType: parsed.data.discountType,
        discountValue: parsed.data.discountValue,
        minOrderAmount: parsed.data.minOrderAmount ?? null,
        maxUses: parsed.data.maxUses ?? null,
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
        isActive: parsed.data.isActive,
      },
    });

    await logAuditEvent({
      userId: session.userId,
      action: "coupon.create",
      resourceType: "coupon",
      resourceId: coupon.id,
      newValues: coupon,
      ipAddress: ip,
      userAgent: req.headers.get("user-agent"),
    });

    return Response.json({ coupon }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

// PATCH /api/admin/coupons?id=xxx — toggle active / update
export async function PATCH(req: NextRequest) {
  const ip = getClientIp(req.headers);
  try {
    const session = await requireAdmin();
    if (!session) throw new AppError("ADMIN_UNAUTHORISED");

    const id = req.nextUrl.searchParams.get("id");
    if (!id) throw new AppError("VALIDATION_ERROR", { id: "Coupon ID required." });

    const body = await req.json();
    const parsed = couponSchema.partial().safeParse(body);
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", parsed.error.flatten());

    const coupon = await prisma.coupon.update({
      where: { id },
      data: {
        ...(parsed.data.isActive !== undefined && { isActive: parsed.data.isActive }),
        ...(parsed.data.expiresAt !== undefined && {
          expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
        }),
        ...(parsed.data.maxUses !== undefined && { maxUses: parsed.data.maxUses }),
      },
    });

    await logAuditEvent({
      userId: session.userId,
      action: "coupon.update",
      resourceType: "coupon",
      resourceId: id,
      newValues: parsed.data,
      ipAddress: ip,
      userAgent: req.headers.get("user-agent"),
    });

    return Response.json({ coupon });
  } catch (error) {
    return errorResponse(error);
  }
}

// DELETE /api/admin/coupons?id=xxx — delete coupon
export async function DELETE(req: NextRequest) {
  const ip = getClientIp(req.headers);
  try {
    const session = await requireAdmin();
    if (!session) throw new AppError("ADMIN_UNAUTHORISED");

    const id = req.nextUrl.searchParams.get("id");
    if (!id) throw new AppError("VALIDATION_ERROR", { id: "Coupon ID required." });

    await prisma.coupon.delete({ where: { id } });

    await logAuditEvent({
      userId: session.userId,
      action: "coupon.delete",
      resourceType: "coupon",
      resourceId: id,
      ipAddress: ip,
      userAgent: req.headers.get("user-agent"),
    });

    return Response.json({ message: "Coupon deleted." });
  } catch (error) {
    return errorResponse(error);
  }
}
