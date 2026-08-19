import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { refundOrder } from "@/lib/repositories/order.repository";
import { getPaymentProvider } from "@/lib/payments/provider";
import { logAuditEvent } from "@/lib/audit";
import { getClientIp } from "@/lib/security/rate-limit";
import { AppError, errorResponse } from "@/lib/errors";
import { z } from "zod";

interface RouteParams {
  params: { id: string };
}

const refundSchema = z.object({
  reason: z.string().max(500).optional(),
});

// POST /api/admin/orders/[id]/refund
//
// Routes through the same PaymentProvider interface used at checkout —
// today this means COD's refund() just returns "handle this manually",
// since cash already changed hands. Once Stripe/JazzCash are wired in,
// their refund() implementations will call the real refund API here with
// zero changes to this route.
export async function POST(req: NextRequest, { params }: RouteParams) {
  const ip = getClientIp(req.headers);

  try {
    const session = await requireAdmin();
    if (!session) throw new AppError("ADMIN_UNAUTHORISED");

    const body = await req.json().catch(() => ({}));
    const parsed = refundSchema.safeParse(body);
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", parsed.error.flatten());

    const order = await prisma.order.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        total: true,
        paymentStatus: true,
        paymentIntentId: true,
        notes: true,
      },
    });
    if (!order) throw new AppError("VALIDATION_ERROR", { id: "Order not found." });
    if (order.paymentStatus !== "paid") {
      throw new AppError("VALIDATION_ERROR", { paymentStatus: "Only paid orders can be refunded." });
    }

    // Determine payment method from the notes field (set at checkout) to
    // route to the right provider's refund() implementation.
    const methodMatch = order.notes?.match(/payment:(\w+)/);
    const paymentMethod = (methodMatch?.[1] as any) ?? "cod";
    const provider = getPaymentProvider(paymentMethod);

    const refundResult = await provider.refund({
      orderId: order.id,
      providerReference: order.paymentIntentId,
      amount: Number(order.total),
    });

    const updated = await refundOrder({
      orderId: order.id,
      amount: Number(order.total),
      providerRefundReference: refundResult.providerRefundReference,
      reason: parsed.data.reason,
    });

    await logAuditEvent({
      userId: session.userId,
      action: "order.refunded",
      resourceType: "order",
      resourceId: order.id,
      newValues: { refundAmount: order.total, message: refundResult.message },
      ipAddress: ip,
      userAgent: req.headers.get("user-agent"),
    });

    return Response.json({ order: updated, message: refundResult.message });
  } catch (error) {
    return errorResponse(error);
  }
}
