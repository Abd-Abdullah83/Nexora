// app/api/sellers/orders/[id]/route.ts
//
// Phase 6 — GET one order line (detail view) and PATCH its fulfillment
// status. [id] here is the order_item ID, NOT the parent order ID — a
// seller acts on their own line, never on the whole multi-seller order.

import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import {
  getSellerOrderLineById,
  updateFulfillmentStatus,
} from "@/lib/sellers/seller-orders.service";
import { updateFulfillmentSchema } from "@/lib/validation/seller-order";
import { logAuditEvent } from "@/lib/audit";
import { getClientIp } from "@/lib/security/rate-limit";
import { AppError, errorResponse } from "@/lib/errors";

async function getActiveSeller(userId: string) {
  const seller = await prisma.seller.findUnique({ where: { userId } });
  if (!seller || seller.status !== "active") return null;
  return seller;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session) throw new AppError("AUTH_REQUIRED");

    const seller = await getActiveSeller(session.userId);
    if (!seller) throw new AppError("AUTH_REQUIRED", { seller: "No active seller account." });

    const line = await getSellerOrderLineById(seller.id, params.id);
    // null here means either genuinely nonexistent OR belongs to another
    // seller — both return identical 404s, by design.
    if (!line) throw new AppError("PRODUCT_NOT_FOUND", { id: "Order line not found." });

    return Response.json({ orderItem: line });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ip = getClientIp(req.headers);

  try {
    const session = await getSession();
    if (!session) throw new AppError("AUTH_REQUIRED");

    const seller = await getActiveSeller(session.userId);
    if (!seller) throw new AppError("AUTH_REQUIRED", { seller: "No active seller account." });

    const body = await req.json();
    const parsed = updateFulfillmentSchema.safeParse(body);
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", parsed.error.flatten());

    const { status, trackingNumber, trackingUrl, cancellationReason } = parsed.data;

    const before = await getSellerOrderLineById(seller.id, params.id);
    if (!before) throw new AppError("PRODUCT_NOT_FOUND", { id: "Order line not found." });

    const updated = await updateFulfillmentStatus(seller.id, params.id, status, {
      trackingNumber,
      trackingUrl,
      cancellationReason,
    });

    await logAuditEvent({
      userId: session.userId,
      action: `seller_order.${status}`,
      resourceType: "order_item",
      resourceId: params.id,
      oldValues: { fulfillmentStatus: before.fulfillmentStatus },
      newValues: { fulfillmentStatus: status, trackingNumber, cancellationReason },
      ipAddress: ip,
      userAgent: req.headers.get("user-agent"),
    });

    return Response.json({ orderItem: updated });
  } catch (error) {
    return errorResponse(error);
  }
}
