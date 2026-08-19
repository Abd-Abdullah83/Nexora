import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/rbac";
import {
  getCategoryById,
  updateCategory,
  safeDeleteCategory,
  moveCategory,
  reorderCategories,
} from "@/lib/repositories/category.repository";
import { AppError } from "@/lib/errors";

// ── GET /api/admin/categories/[id] ───────────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const category = await getCategoryById(params.id);
  if (!category) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ category });
}

// ── PUT /api/admin/categories/[id] ───────────────────────────────────────
// Handles: update fields, move to new parent, reorder siblings
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();

    // Move operation
    if ("newParentId" in body) {
      await moveCategory(params.id, body.newParentId ?? null);
      return NextResponse.json({ success: true });
    }

    // Reorder siblings
    if (Array.isArray(body.orderedIds)) {
      await reorderCategories(body.orderedIds);
      return NextResponse.json({ success: true });
    }

    // Regular update
    const category = await updateCategory(params.id, {
      name: body.name,
      slug: body.slug,
      description: body.description,
      imageUrl: body.imageUrl,
      displayOrder: body.displayOrder,
      isActive: body.isActive,
    });
    return NextResponse.json({ category });
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    if ((err as any)?.code === "P2002") {
      return NextResponse.json(
        { error: "Slug already in use." },
        { status: 409 }
      );
    }
    console.error("[PUT /api/admin/categories/[id]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ── DELETE /api/admin/categories/[id] ────────────────────────────────────
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    await safeDeleteCategory(params.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}