import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/rbac";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { CategoryAttributeManager } from "@/components/admin/CategoryAttributeManager";

interface PageProps {
  params: { id: string };
}

export default async function AdminCategoryDetailPage({ params }: PageProps) {
  const session = await requireAdmin();
  if (!session) notFound();

  const category = await prisma.category.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, slug: true },
  });

  if (!category) notFound();

  return (
    <AdminLayout>
      <nav className="text-xs text-slate">
        <Link href="/admin/categories" className="hover:text-brass transition">
          Categories
        </Link>
        <span className="mx-2">/</span>
        <span className="text-cream">{category.name}</span>
      </nav>

      <h1 className="mt-2 font-display text-2xl text-cream">{category.name}</h1>
      <p className="text-sm text-slate">/{category.slug}</p>

      <div className="mt-6">
        <CategoryAttributeManager categoryId={category.id} />
      </div>
    </AdminLayout>
  );
}
