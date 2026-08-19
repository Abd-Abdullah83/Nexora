// app/api/checkout/orders/route.ts
//
// PHASE 6 PATCH — only change from your existing Phase 5/6 version: each
// line item created now also captures the product's sellerId at the
// moment of purchase, exactly the same snapshot pattern already used for
// productName/productSku (so a later seller name change or product
// deletion never alters historical order records).
//
// Everything else in this file — idempotency check, stock re-validation,
// coupon logic, the $transaction stock-race guard, email send — is
// UNCHANGED from your current working version. Only the `product` select
// in the cart fetch and the `items.create` mapping below were touched;
// search this file for "PHASE 6" to find both edits.

import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { generateOrderNumber } from "@/lib/repositories/order.repository";
import { logAuditEvent } from "@/lib/audit";
import { getClientIp } from "@/lib/security/rate-limit";
import { sendOrderConfirmationEmail } from "@/lib/email/send";
import { AppError, errorResponse } from "@/lib/errors";
import { z } from "zod";

const addressSchema = z.object({
  fullName: z.string().min(2).max(150),
  phone: z.string().min(7).max(20),
  addressLine1: z.string().min(5).max(200),
  addressLine2: z.string().max(200).optional(),
  city: z.string().min(2).max(100),
  state: z.string().min(2).max(100),
  postalCode: z.string().min(3).max(20),
  country: z.string().min(2).max(100),
});

const orderSchema = z.object({
  shippingAddress: addressSchema,
  couponCode: z.string().optional(),
  paymentMethod: z.enum([
    "cod",
    "jazzcash",
    "easypaisa",
    "card_pk",
    "stripe",
    "paypal",
    "payoneer",
  ]),
  notes: z.string().max(500).optional(),
  idempotencyKey: z.string().min(1).max(100),
});

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cod: "Cash on Delivery",
  jazzcash: "JazzCash",
  easypaisa: "EasyPaisa",
  card_pk: "Credit / Debit Card",
  stripe: "Stripe",
  paypal: "PayPal",
  payoneer: "Payoneer",
};

// ── GET /api/checkout/orders — unchanged ────────────────────────────────────
export async function GET() {
  try {
    const session = await getSession();
    if (!session) throw new AppError("AUTH_REQUIRED");

    const orders = await prisma.order.findMany({
      where: { userId: session.userId },
      include: { items: true },
      orderBy: { createdAt: "desc" },
    });

    return Response.json({ orders });
  } catch (error) {
    return errorResponse(error);
  }
}

// ── POST /api/checkout/orders ──────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);

  try {
    const session = await getSession();
    if (!session) throw new AppError("AUTH_REQUIRED");

    const body = await req.json();
    const parsed = orderSchema.safeParse(body);
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", parsed.error.flatten());

    const { shippingAddress, couponCode, paymentMethod, notes, idempotencyKey } = parsed.data;

    // ── Idempotency: prevent duplicate orders — unchanged ──────────────────
    const existing = await prisma.order.findFirst({
      where: { userId: session.userId, notes: { startsWith: `idem:${idempotencyKey}` } },
      include: { items: true },
    });
    if (existing) return Response.json({ order: existing }, { status: 200 });

    // ── Fetch cart fresh from DB ────────────────────────────────────────────
    // PHASE 6: added `sellerId: true` to the product select below — this is
    // the only change to this query.
    const cartItems = await prisma.cartItem.findMany({
      where: { userId: session.userId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            price: true,
            stockQty: true,
            status: true,
            sellerId: true, // ← PHASE 6
          },
        },
      },
    });

    if (cartItems.length === 0) {
      return Response.json({ error: { message: "Your cart is empty." } }, { status: 422 });
    }

    // ── Server-side price + stock re-validation — unchanged logic ──────────
    const stockErrors: string[] = [];
    let subtotal = 0;

    const lineItems = cartItems.map((item) => {
      const p = item.product;
      if (p.status !== "active") {
        stockErrors.push(`"${p.name}" is no longer available.`);
        return null;
      }
      if (p.stockQty < item.quantity) {
        stockErrors.push(`"${p.name}" only has ${p.stockQty} left in stock.`);
        return null;
      }
      const unitPrice = Number(p.price);
      const lineTotal = unitPrice * item.quantity;
      subtotal += lineTotal;
      return {
        productId: p.id,
        productName: p.name,
        productSku: p.sku,
        sellerId: p.sellerId, // ← PHASE 6: snapshot the seller at purchase time
        quantity: item.quantity,
        unitPrice,
        totalPrice: lineTotal,
      };
    });

    if (stockErrors.length > 0) {
      return Response.json({ error: { message: stockErrors.join(" ") } }, { status: 422 });
    }

    // ── Coupon validation — unchanged ───────────────────────────────────────
    let discountAmount = 0;
    let couponId: string | undefined;

    if (couponCode) {
      const coupon = await prisma.coupon.findUnique({
        where: { code: couponCode.toUpperCase() },
      });
      if (
        coupon &&
        coupon.isActive &&
        !(coupon.expiresAt && coupon.expiresAt < new Date()) &&
        !(coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) &&
        !(coupon.minOrderAmount && subtotal < Number(coupon.minOrderAmount))
      ) {
        discountAmount =
          coupon.discountType === "percentage"
            ? (subtotal * Number(coupon.discountValue)) / 100
            : Math.min(Number(coupon.discountValue), subtotal);
        couponId = coupon.id;
      }
    }

    const total = Math.max(0, subtotal - discountAmount);

    // ── Create order + decrement stock atomically — unchanged transaction
    // logic, only the items.create mapping below gained sellerId ──────────
    const order = await prisma.$transaction(async (tx) => {
      for (const item of cartItems) {
        const fresh = await tx.product.findUnique({
          where: { id: item.productId },
          select: { stockQty: true, name: true },
        });
        if (!fresh || fresh.stockQty < item.quantity) {
          throw new Error(`STOCK_RACE:${item.product.name}`);
        }
        await tx.product.update({
          where: { id: item.productId },
          data: { stockQty: { decrement: item.quantity } },
        });
      }

      if (couponId) {
        await tx.coupon.update({
          where: { id: couponId },
          data: { usedCount: { increment: 1 } },
        });
      }

      const created = await tx.order.create({
        data: {
          orderNumber: generateOrderNumber(),
          userId: session.userId,
          status: "pending",
          paymentStatus: paymentMethod === "cod" ? "unpaid" : "pending",
          subtotal,
          discountAmount,
          shippingCost: 0,
          taxAmount: 0,
          total,
          currency: "PKR",
          shippingAddress,
          couponId,
          notes: [`idem:${idempotencyKey}`, `payment:${paymentMethod}`, notes]
            .filter(Boolean)
            .join(" | "),
          items: {
            create: lineItems.filter(Boolean).map((li) => ({
              productId: li!.productId,
              productName: li!.productName,
              productSku: li!.productSku,
              sellerId: li!.sellerId, // ← PHASE 6
              quantity: li!.quantity,
              unitPrice: li!.unitPrice,
              totalPrice: li!.totalPrice,
              // fulfillmentStatus defaults to "pending" — no need to set explicitly
            })),
          },
        },
        include: {
          items: true,
          user: { select: { fullName: true, email: true } },
        },
      });

      await tx.cartItem.deleteMany({ where: { userId: session.userId } });

      return created;
    });

    // ── Send order confirmation email — unchanged ───────────────────────────
    try {
      await sendOrderConfirmationEmail({
        orderNumber: order.orderNumber,
        customerName: order.user.fullName,
        customerEmail: order.user.email,
        items: order.items.map((item) => ({
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          totalPrice: Number(item.totalPrice),
        })),
        subtotal: Number(order.subtotal),
        discountAmount: Number(order.discountAmount),
        total: Number(order.total),
        paymentMethod: PAYMENT_METHOD_LABELS[paymentMethod] ?? paymentMethod,
        shippingAddress: shippingAddress as any,
      });
    } catch (emailErr) {
      console.error("[order] Failed to send confirmation email:", emailErr);
    }

    await logAuditEvent({
      userId: session.userId,
      action: "order.create",
      resourceType: "order",
      resourceId: order.id,
      newValues: { orderNumber: order.orderNumber, total, paymentMethod },
      ipAddress: ip,
      userAgent: req.headers.get("user-agent"),
    });

    return Response.json({ order }, { status: 201 });
  } catch (error: any) {
    if (error?.message?.startsWith("STOCK_RACE:")) {
      const name = error.message.replace("STOCK_RACE:", "");
      return Response.json(
        { error: { message: `"${name}" just went out of stock. Please update your cart.` } },
        { status: 422 }
      );
    }
    return errorResponse(error);
  }
}
