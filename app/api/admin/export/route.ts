import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { AppError, errorResponse } from "@/lib/errors";

function toCSV(rows: Record<string, any>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((h) => {
          const val = row[h] ?? "";
          const str = String(val).replace(/"/g, '""');
          return str.includes(",") || str.includes('"') || str.includes("\n")
            ? `"${str}"`
            : str;
        })
        .join(",")
    ),
  ];
  return lines.join("\n");
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) throw new AppError("ADMIN_UNAUTHORISED");

    const type = req.nextUrl.searchParams.get("type") ?? "orders";
    const from = req.nextUrl.searchParams.get("from");
    const to = req.nextUrl.searchParams.get("to");

    const dateFilter =
      from || to
        ? {
            createdAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {};

    let csv = "";
    let filename = "";

    if (type === "orders") {
      const orders = await prisma.order.findMany({
        where: dateFilter,
        include: { user: { select: { fullName: true, email: true } } },
        orderBy: { createdAt: "desc" },
      });
      const rows = orders.map((o) => ({
        orderNumber: o.orderNumber,
        date: o.createdAt.toISOString().slice(0, 10),
        customer: o.user.fullName,
        email: o.user.email,
        status: o.status,
        paymentStatus: o.paymentStatus,
        subtotal: Number(o.subtotal).toFixed(2),
        discount: Number(o.discountAmount).toFixed(2),
        total: Number(o.total).toFixed(2),
        currency: o.currency,
      }));
      csv = toCSV(rows);
      filename = "nexora-orders.csv";
    } else if (type === "products") {
      const products = await prisma.product.findMany({
        where: { deletedAt: null },
        include: { category: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      });
      const rows = products.map((p) => ({
        name: p.name,
        sku: p.sku,
        category: p.category.name,
        price: Number(p.price).toFixed(2),
        stock: p.stockQty,
        status: p.status,
        createdAt: p.createdAt.toISOString().slice(0, 10),
      }));
      csv = toCSV(rows);
      filename = "nexora-products.csv";
    } else if (type === "customers") {
      const customers = await prisma.user.findMany({
        where: { role: "customer", deletedAt: null },
        select: {
          fullName: true,
          email: true,
          username: true,
          emailVerified: true,
          createdAt: true,
          _count: { select: { orders: true } },
        },
        orderBy: { createdAt: "desc" },
      });
      const rows = customers.map((c) => ({
        name: c.fullName,
        email: c.email,
        username: c.username ?? "",
        verified: c.emailVerified ? "Yes" : "No",
        orders: c._count.orders,
        joined: c.createdAt.toISOString().slice(0, 10),
      }));
      csv = toCSV(rows);
      filename = "nexora-customers.csv";
    }

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}