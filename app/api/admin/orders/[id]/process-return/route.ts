import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { logAuditEvent } from "@/lib/audit";
import { getClientIp } from "@/lib/security/rate-limit";
import { AppError, errorResponse } from "@/lib/errors";
import { z } from "zod";

const schema = z.object({
  restockItems: z.boolean().default(true),
  reason: z.string().max(500).optional(),
});

function getCsrf(req: NextRequest) {
  return req.headers.get("x-csrf-token");
}

// POST /api/admin/orders/[id]/process-return
// Marks order as refunded AND optionally restocks every line item.
// This is the backend for the admin "Process Return" action.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ip = getClientIp(req.headers);

  try {
    const session = await requireAdmin();
    if (!session) throw new AppError("ADMIN_UNAUTHORISED");

    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success)
      throw new AppError("VALIDATION_ERROR", parsed.error.flatten());

    const { restockItems, reason } = parsed.data;

    const order = await prisma.order.findUnique({
      where: { id: params.id },
      include: { items: true },
    });

    if (!order) throw new AppError("VALIDATION_ERROR", { id: "Order not found." });

    if (!["paid", "confirmed", "shipped", "delivered"].includes(order.paymentStatus) &&
        order.paymentStatus !== "paid") {
      throw new AppError("VALIDATION_ERROR", {
        paymentStatus: "Only paid orders can be returned.",
      });
    }

    await prisma.$transaction(async (tx) => {
      // 1. Restock inventory if requested
      if (restockItems) {
        for (const item of order.items) {
          if (item.variantId) {
            await tx.productVariant.update({
              where: { id: item.variantId },
              data: { stockQty: { increment: item.quantity } },
            });
          } else {
            await tx.product.update({
              where: { id: item.productId },
              data: { stockQty: { increment: item.quantity } },
            });
          }
        }
      }

      // 2. Mark order as refunded
      await tx.order.update({
        where: { id: params.id },
        data: {
          paymentStatus: "refunded",
          status: "refunded",
          refundedAt: new Date(),
          refundAmount: order.total,
          notes: reason
            ? `return: ${reason}`
            : order.notes,
        },
      });
    });

    await logAuditEvent({
      userId: session.userId,
      action: "order.return_processed",
      resourceType: "order",
      resourceId: params.id,
      newValues: {
        refundAmount: Number(order.total),
        restockItems,
        reason,
      },
      ipAddress: ip,
      userAgent: req.headers.get("user-agent"),
    });

    return Response.json({
      message: restockItems
        ? "Order refunded and inventory restocked."
        : "Order refunded. Inventory was not restocked.",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
