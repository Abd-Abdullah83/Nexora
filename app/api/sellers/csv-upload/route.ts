// app/api/sellers/csv-upload/route.ts
// Phase 5 gap — bulk product listing via CSV.
// Accepts multipart/form-data with a single "file" field (CSV).
// Validates each row, creates products as drafts under the seller's store,
// returns a per-row result so the seller knows exactly which rows succeeded
// and which failed without losing the whole batch on one bad row.

import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { parseProductCsv } from "@/lib/utils/csv";
import { generateUniqueSlug } from "@/lib/utils/slug";
import { rateLimit, getClientIp } from "@/lib/security/rate-limit";
import { AppError, errorResponse } from "@/lib/errors";

const MAX_ROWS = 200;
const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2 MB

async function getActiveSeller(userId: string) {
  const seller = await prisma.seller.findUnique({
    where: { userId },
    include: { store: { select: { id: true } } },
  });
  if (!seller || seller.status !== "active") return null;
  return seller;
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  try {
    const session = await getSession();
    if (!session) throw new AppError("AUTH_REQUIRED");

    const seller = await getActiveSeller(session.userId);
    if (!seller) throw new AppError("AUTH_REQUIRED", { seller: "No active seller account." });

    // Rate limit — 3 bulk uploads per hour
    const { allowed } = await rateLimit(`csv-upload:${seller.id}`, 3, 60);
    if (!allowed) throw new AppError("RATE_LIMIT_EXCEEDED");

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) throw new AppError("VALIDATION_ERROR", { file: "No file provided." });
    if (!file.name.endsWith(".csv")) {
      throw new AppError("VALIDATION_ERROR", { file: "Only .csv files are accepted." });
    }
    if (file.size > MAX_FILE_BYTES) {
      throw new AppError("VALIDATION_ERROR", { file: "File must be under 2 MB." });
    }

    const text = await file.text();
    const { rows, parseErrors } = parseProductCsv(text);

    if (parseErrors.length > 0 && rows.length === 0) {
      return Response.json({ success: false, parseErrors }, { status: 422 });
    }

    if (rows.length > MAX_ROWS) {
      throw new AppError("VALIDATION_ERROR", {
        file: `CSV contains ${rows.length} rows — maximum is ${MAX_ROWS} per upload.`,
      });
    }

    // Process rows one at a time so a failure on row N doesn't roll back rows 1..N-1
    const results: { row: number; success: boolean; productId?: string; error?: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        // Look up category by slug or name
        const category = await prisma.category.findFirst({
          where: {
            OR: [
              { slug: row.categorySlug ?? "" },
              { name: row.categoryName ?? "" },
            ],
            isActive: true,
          },
        });
        if (!category) {
          results.push({ row: i + 2, success: false, error: `Category "${row.categorySlug ?? row.categoryName}" not found.` });
          continue;
        }

        // Check SKU uniqueness
        const skuExists = await prisma.product.findUnique({ where: { sku: row.sku } });
        if (skuExists) {
          results.push({ row: i + 2, success: false, error: `SKU "${row.sku}" already exists.` });
          continue;
        }

        const slug = await generateUniqueSlug(
          row.name,
          async (candidate) => !!(await prisma.product.findUnique({ where: { slug: candidate } }))
        );

        const product = await prisma.product.create({
          data: {
            name: row.name,
            slug,
            description: row.description ?? "",
            shortDescription: row.shortDescription ?? undefined,
            price: row.price,
            comparePrice: row.comparePrice ?? undefined,
            sku: row.sku,
            stockQty: row.stockQty ?? 0,
            categoryId: category.id,
            sellerId: seller.id,
            currency: row.currency ?? "PKR",
            status: "draft", // always draft — seller must review and publish
            tags: row.tags ?? [],
          },
          select: { id: true },
        });

        results.push({ row: i + 2, success: true, productId: product.id });
      } catch (err: any) {
        results.push({ row: i + 2, success: false, error: err?.message ?? "Unknown error." });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    return Response.json({
      success: true,
      summary: { total: rows.length, created: successCount, failed: failCount },
      results,
      parseErrors,
    }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
