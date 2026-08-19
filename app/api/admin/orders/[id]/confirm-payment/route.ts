import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/rbac";
import { confirmOrderPayment } from "@/lib/repositories/order.repository";
import { logAuditEvent } from "@/lib/audit";
import { getClientIp } from "@/lib/security/rate-limit";
import { AppError, errorResponse } from "@/lib/errors";

interface RouteParams {
  params: { id: string };
}

// POST /api/admin/orders/[id]/confirm-payment
//
// Manually marks an order as paid — used today for COD orders once cash
// is collected on delivery. The exact same underlying function
// (confirmOrderPayment) will be called by a Stripe/JazzCash/etc. webhook
// handler once a real gateway is wired in — this route and that webhook
// are just two different callers of one shared, idempotent function.
//
// This is also where stock actually decrements (see order.repository.ts).
export async function POST(req: NextRequest, { params }: RouteParams) {
  const ip = getClientIp(req.headers);

  try {
    const session = await requireAdmin();
    if (!session) throw new AppError("ADMIN_UNAUTHORISED");

    const order = await confirmOrderPayment({
      orderId: params.id,
      confirmedBy: "admin",
      adminUserId: session.userId,
    });

    await logAuditEvent({
      userId: session.userId,
      action: "order.payment_confirmed",
      resourceType: "order",
      resourceId: params.id,
      newValues: { paymentStatus: order.paymentStatus, paidAt: order.paidAt },
      ipAddress: ip,
      userAgent: req.headers.get("user-agent"),
    });

    return Response.json({ order });
  } catch (error) {
    return errorResponse(error);
  }
}
