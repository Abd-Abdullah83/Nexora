// app/api/sellers/messages/resolve-order/route.ts
//
// GET /api/sellers/messages/resolve-order?sellerId=xxx
//
// Used by MessageSellerButton when no orderId is available in context
// (e.g. product detail page). Finds the buyer's most recent PAID order
// that contains at least one item from this seller, and returns that
// orderId so the message thread can be opened.
//
// Returns:
//   { orderId: string }   — most recent qualifying order found
//   { orderId: null }     — buyer has no paid order from this seller
//
// Auth: buyer must be logged in. Returns 401 if not.
// The sellerId in the query param is validated — returns null (not 400)
// for unknown seller IDs so the button degrades gracefully.

import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { errorResponse, AppError } from "@/lib/errors";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) throw new AppError("AUTH_REQUIRED");

    const { searchParams } = new URL(req.url);
    const sellerId = searchParams.get("sellerId");

    if (!sellerId) {
      return Response.json({ orderId: null });
    }

    // Find the buyer's most recent order that:
    // 1. Belongs to this buyer
    // 2. Contains at least one item from this seller
    // 3. Payment was confirmed (paid)
    const orderItem = await prisma.orderItem.findFirst({
      where: {
        sellerId,
        order: {
          userId: session.userId,
          paymentStatus: "paid",
        },
      },
      orderBy: {
        order: { createdAt: "desc" },
      },
      select: {
        orderId: true,
      },
    });

    return Response.json({ orderId: orderItem?.orderId ?? null });
  } catch (error) {
    return errorResponse(error);
  }
}
