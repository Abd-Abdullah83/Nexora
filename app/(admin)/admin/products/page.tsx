"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { AdminLayout } from "@/components/admin/AdminLayout";

interface AdminProduct {
  id: string;
  name: string;
  sku: string;
  price: string;
  comparePrice: string | null;
  salePrice: string | null;
  currency: string;
  stockQty: number;
  status: string;
  category: { name: string };
}

function getCsrf(): string {
  return (
    document.cookie
      .split("; ")
      .find((c) => c.startsWith("csrf_token="))
      ?.split("=")[1] ?? ""
  );
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      if (statusFilter) params.set("status", statusFilter);

      const res = await fetch(`/api/admin/products?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error?.message || "Failed to load products.");
        return;
      }
      setProducts(data.items);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Archive "${name}"? This removes it from the storefront.`)) return;

    const res = await fetch(`/api/admin/products/${id}`, {
      method: "DELETE",
      headers: { "x-csrf-token": getCsrf() },
    });
    if (res.ok) {
      loadProducts();
    } else {
      const data = await res.json();
      alert(data.error?.message || "Failed to archive product.");
    }
  }

  async function handleDuplicate(id: string) {
    const res = await fetch(`/api/admin/products/${id}/duplicate`, {
      method: "POST",
      headers: { "x-csrf-token": getCsrf() },
    });
    if (res.ok) {
      loadProducts();
    } else {
      const data = await res.json();
      alert(data.error?.message || "Failed to duplicate product.");
    }
  }

  return (
    <AdminLayout>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl text-cream">Products</h1>
        <Link
          href="/admin/products/new"
          className="rounded-sm bg-brass px-4 py-2 text-sm font-semibold uppercase tracking-wider text-ink hover:bg-brassLight"
        >
          New Product
        </Link>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <input
          type="search"
          placeholder="Search products..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-sm border border-white/10 bg-surface px-3 py-2 text-sm text-cream outline-none placeholder:text-slate/60 focus:border-brass/50"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-sm border border-white/10 bg-surface px-3 py-2 text-sm text-cream outline-none focus:border-brass/50"
        >
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {error && <p className="mt-4 text-sm text-red-300">{error}</p>}

      {loading ? (
        <p className="mt-8 text-sm text-slate">Loading products...</p>
      ) : products.length === 0 ? (
        <p className="mt-8 text-sm text-slate">No products match your filters.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-sm border border-white/[0.08]">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface text-xs uppercase tracking-wider text-slate">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const currency = p.currency || "PKR";
                const basePrice = Number(p.price);
                const salePrice = p.salePrice ? Number(p.salePrice) : null;
                const onSale = salePrice !== null && salePrice < basePrice;

                return (
                  <tr key={p.id} className="border-t border-white/[0.08] text-cream">
                    <td className="px-4 py-3">{p.name}</td>
                    <td className="px-4 py-3 text-slate">{p.sku}</td>
                    <td className="px-4 py-3 text-slate">{p.category.name}</td>
                    <td className="px-4 py-3">
                      {onSale ? (
                        <div className="flex flex-col gap-0.5">
                          {/* Sale price in red */}
                          <span className="font-semibold text-red-400">
                            {currency} {salePrice!.toFixed(2)}
                          </span>
                          {/* Original price struck through */}
                          <span className="text-xs text-slate/60 line-through">
                            {currency} {basePrice.toFixed(2)}
                          </span>
                        </div>
                      ) : (
                        <span>
                          {currency} {basePrice.toFixed(2)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">{p.stockQty}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-sm px-2 py-0.5 text-xs ${p.status === "active"
                          ? "bg-emerald/20 text-emerald-200"
                          : p.status === "draft"
                            ? "bg-brass/20 text-brass"
                            : "bg-white/10 text-slate"
                          }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-3 text-xs">
                        <Link
                          href={`/admin/products/${p.id}/edit`}
                          className="text-brass hover:underline"
                        >
                          Edit
                        </Link>
                        <button
                          onClick={() => handleDuplicate(p.id)}
                          className="text-slate hover:text-brass"
                        >
                          Duplicate
                        </button>
                        <button
                          onClick={() => handleDelete(p.id, p.name)}
                          className="text-red-300 hover:text-red-200"
                        >
                          Archive
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  );
}
