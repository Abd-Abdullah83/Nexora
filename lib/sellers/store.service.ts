// ─────────────────────────────────────────────────────────────────────────
// lib/sellers/store.service.ts
//
// Store creation (triggered automatically on seller approval) and
// customization. Slug is sanitized via the existing slugify() utility —
// it strips everything down to [a-z0-9-], which inherently prevents any
// special-character injection through the slug itself. name/description
// are plain text, rendered as JSX text content on the public storefront
// page (never via dangerouslySetInnerHTML) — React's normal escaping is
// the real protection there; Zod just trims/length-limits as a second
// layer.
// ─────────────────────────────────────────────────────────────────────────

import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors";
import { logAuditEvent } from "@/lib/audit";
import { generateUniqueSlug } from "@/lib/utils/slug";

/**
 * Called once, automatically, from verification.service.ts's approval
 * branch — NOT exposed as something a seller or admin can call directly.
 * Idempotent: if a store already exists for this seller (shouldn't
 * happen, but defensive), returns it instead of erroring.
 */
export async function createStoreForSeller(params: {
  sellerId: string;
  displayName: string;
}) {
  const existing = await prisma.store.findUnique({ where: { sellerId: params.sellerId } });
  if (existing) return existing;

  const slug = await generateUniqueSlug(params.displayName, async (candidate) => {
    const hit = await prisma.store.findUnique({ where: { slug: candidate } });
    return !!hit;
  });

  const store = await prisma.store.create({
    data: {
      sellerId: params.sellerId,
      name: params.displayName,
      slug,
    },
  });

  await logAuditEvent({
    action: "seller.store_created",
    resourceType: "store",
    resourceId: store.id,
    ipAddress: "internal",
    newValues: { sellerId: params.sellerId, slug },
  });

  return store;
}

export async function getStoreForSeller(sellerId: string) {
  return prisma.store.findUnique({ where: { sellerId } });
}

export async function getPublicStoreBySlug(slug: string) {
  return prisma.store.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      logoUrl: true,
      bannerUrl: true,
      description: true,
      themeJson: true,
      seller: { select: { id: true, status: true } },
    },
  });
}

export async function updateStore(
  sellerId: string,
  data: {
    name?: string;
    slug?: string;
    logoUrl?: string | null;
    bannerUrl?: string | null;
    description?: string | null;
    themeJson?: Record<string, unknown>;
  }
) {
  const store = await prisma.store.findUnique({ where: { sellerId } });
  if (!store) {
    throw new AppError("VALIDATION_ERROR", { store: "No store found — your application may not be approved yet." });
  }

  if (data.slug && data.slug !== store.slug) {
    const taken = await prisma.store.findUnique({ where: { slug: data.slug } });
    if (taken) {
      throw new AppError("VALIDATION_ERROR", { slug: "This store URL is already taken." });
    }
  }

  const updated = await prisma.store.update({
    where: { sellerId },
    data,
  });

  await logAuditEvent({
    action: "seller.store_updated",
    resourceType: "store",
    resourceId: store.id,
    ipAddress: "internal",
    oldValues: { name: store.name, slug: store.slug },
    newValues: data,
  });

  return updated;
}
