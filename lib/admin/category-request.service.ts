// lib/admin/category-request.service.ts
//
// Admin review queue for seller-submitted category requests.
// approveCategoryRequest reuses the existing createCategory() repository
// function (same one admin's own /api/admin/categories POST route uses)
// so approved requests get identical level computation, slug uniqueness,
// and defaults — no parallel category-creation logic to drift out of sync.

import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors";
import { logAuditEvent } from "@/lib/audit";
import { createCategory } from "@/lib/repositories/category.repository";
import { slugify, generateUniqueSlug } from "@/lib/utils/slug";
import type { ResolveCategoryRequestInput } from "@/lib/validation/category-request";

export async function getCategoryRequestQueue(params: {
  status?: "pending" | "approved" | "rejected";
  page?: number;
  pageSize?: number;
}) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, params.pageSize ?? 20));
  const where = params.status ? { status: params.status } : {};

  const [items, total] = await Promise.all([
    prisma.categoryRequest.findMany({
      where,
      orderBy: { createdAt: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        seller: {
          select: {
            id: true,
            displayName: true,
            businessEmail: true,
            store: { select: { name: true } },
          },
        },
        parent: { select: { name: true } },
        resolvedCategory: { select: { id: true, name: true, slug: true } },
      },
    }),
    prisma.categoryRequest.count({ where }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function approveCategoryRequest(params: {
  requestId: string;
  adminUserId: string;
  note?: string;
  displayOrder?: number;
}) {
  const request = await prisma.categoryRequest.findUnique({ where: { id: params.requestId } });
  if (!request) throw new AppError("VALIDATION_ERROR", { requestId: "Request not found." });
  if (request.status !== "pending") {
    throw new AppError("VALIDATION_ERROR", { status: "This request has already been resolved." });
  }

  const slug = await generateUniqueSlug(request.name, async (candidate) => {
    const hit = await prisma.category.findUnique({ where: { slug: candidate } });
    return !!hit;
  });

  const category = await createCategory({
    name: request.name,
    slug,
    description: request.description ?? undefined,
    parentId: request.parentId ?? null,
    displayOrder: params.displayOrder ?? 0,
    isActive: true,
  });

  await prisma.categoryRequest.update({
    where: { id: params.requestId },
    data: {
      status: "approved",
      resolvedCategoryId: category.id,
      reviewedBy: params.adminUserId,
      reviewedAt: new Date(),
      resolutionNote: params.note,
    },
  });

  await logAuditEvent({
    userId: params.adminUserId,
    action: "admin.category_request_approved",
    resourceType: "category_request",
    resourceId: params.requestId,
    ipAddress: "internal",
    newValues: { categoryId: category.id, slug: category.slug },
  });

  return { requestId: params.requestId, category };
}

export async function rejectCategoryRequest(params: {
  requestId: string;
  adminUserId: string;
  note: string;
}) {
  const request = await prisma.categoryRequest.findUnique({ where: { id: params.requestId } });
  if (!request) throw new AppError("VALIDATION_ERROR", { requestId: "Request not found." });
  if (request.status !== "pending") {
    throw new AppError("VALIDATION_ERROR", { status: "This request has already been resolved." });
  }

  await prisma.categoryRequest.update({
    where: { id: params.requestId },
    data: {
      status: "rejected",
      reviewedBy: params.adminUserId,
      reviewedAt: new Date(),
      resolutionNote: params.note,
    },
  });

  await logAuditEvent({
    userId: params.adminUserId,
    action: "admin.category_request_rejected",
    resourceType: "category_request",
    resourceId: params.requestId,
    ipAddress: "internal",
    newValues: { note: params.note },
  });

  return { requestId: params.requestId };
}

export async function resolveCategoryRequest(params: {
  requestId: string;
  adminUserId: string;
  input: ResolveCategoryRequestInput;
}) {
  if (params.input.action === "approve") {
    return approveCategoryRequest({
      requestId: params.requestId,
      adminUserId: params.adminUserId,
      note: params.input.note,
      displayOrder: params.input.displayOrder,
    });
  }
  return rejectCategoryRequest({
    requestId: params.requestId,
    adminUserId: params.adminUserId,
    note: params.input.note!,
  });
}
