import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/rbac";
import {
  getCategoryTree,
  createCategory,
} from "@/lib/repositories/category.repository";
import { AppError } from "@/lib/errors";

// ── GET /api/admin/categories ─────────────────────────────────────────────
export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const tree = await getCategoryTree();
  return NextResponse.json({ tree });
}

// ── POST /api/admin/categories ────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();

    if (!body.name?.trim()) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    // Auto-generate slug from name if not provided
    const slug =
      body.slug?.trim() ||
      body.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

    const category = await createCategory({
      name: body.name.trim(),
      slug,
      description: body.description,
      imageUrl: body.imageUrl,
      parentId: body.parentId ?? null,
      displayOrder: body.displayOrder ?? 0,
      isActive: body.isActive ?? true,
    });

    return NextResponse.json({ category }, { status: 201 });
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    if ((err as any)?.code === "P2002") {
      return NextResponse.json(
        { error: "A category with that slug already exists." },
        { status: 409 }
      );
    }
    console.error("[POST /api/admin/categories]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}