// lib/sellers/category-request.service.ts
//
// A seller who can't find the right category in the listing form dropdown
// submits a request here instead of creating a category directly. This
// keeps the shared taxonomy admin-controlled — see
// lib/admin/category-request.service.ts for the approval side, which
// reuses the existing createCategory() repository function so approved
// requests get identical level/slug handling to admin-created categories.

import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors";
import { logAuditEvent } from "@/lib/audit";
import type { CreateCategoryRequestInput } from "@/lib/validation/category-request";

export async function createCategoryRequest(
  sellerId: string,
  actorUserId: string,
  data: CreateCategoryRequestInput
) {
  if (data.parentId) {
    const parent = await prisma.category.findFirst({
      where: { id: data.parentId, isActive: true },
      select: { id: true },
    });
    if (!parent) {
      throw new AppError("VALIDATION_ERROR", { parentId: "Parent category not found or inactive." });
    }
  }

  // Prevent spamming duplicate pending requests for the same name
  const existingPending = await prisma.categoryRequest.findFirst({
    where: {
      sellerId,
      status: "pending",
      name: { equals: data.name, mode: "insensitive" },
    },
  });
  if (existingPending) {
    throw new AppError("VALIDATION_ERROR", {
      name: "You already have a pending request for this category name.",
    });
  }

  const request = await prisma.categoryRequest.create({
    data: {
      sellerId,
      name: data.name,
      description: data.description ?? undefined,
      parentId: data.parentId ?? undefined,
    },
  });

  await logAuditEvent({
    userId: actorUserId,
    action: "seller.category_request_created",
    resourceType: "category_request",
    resourceId: request.id,
    ipAddress: "internal",
    newValues: { name: data.name, parentId: data.parentId },
  });

  return request;
}

export async function getCategoryRequestsForSeller(sellerId: string) {
  return prisma.categoryRequest.findMany({
    where: { sellerId },
    orderBy: { createdAt: "desc" },
    include: {
      parent: { select: { name: true } },
      resolvedCategory: { select: { id: true, name: true, slug: true } },
    },
  });
}
