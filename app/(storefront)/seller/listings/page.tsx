"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { SellerLayout } from "@/components/seller/SellerLayout";

interface Listing {
  id: string;
  name: string;
  slug: string;
  price: number;
  status: "draft" | "active" | "archived";
  stockQty: number;
  sku: string | null;
  createdAt: string;
  images: { url: string; altText: string | null }[];
  category: { name: string } | null;
}

interface ListingsData {
  products: Listing[];
  total: number;
  page: number;
  pageSize: number;
}

const STATUS_STYLES: Record<string, string> = {
  active:   "bg-emerald-50 text-emerald-700 border-emerald-200",
  draft:    "bg-amber-50 text-amber-700 border-amber-200",
  archived: "bg-gray-100 text-gray-500 border-gray-200",
};

function getCsrf() {
  return document.cookie.split("; ").find((c) => c.startsWith("csrf_token="))?.split("=")[1] ?? "";
}

export default function SellerListingsPage() {
  const [data, setData] = useState<ListingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [archiving, setArchiving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/sellers/listings?${params}`);
      const json = await res.json();
      if (!res.ok) { setError(json.error?.message ?? "Could not load listings."); return; }
      setData(json);
    } catch { setError("Network error."); }
    finally { setLoading(false); }
  }, [page, statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function handleArchive(id: string, name: string) {
    if (!confirm(`Archive "${name}"? It will no longer be visible to buyers.`)) return;
    setArchiving(id);
    try {
      const res = await fetch(`/api/sellers/listings/${id}`, {
        method: "DELETE",
        headers: { "x-csrf-token": getCsrf() },
      });
      if (!res.ok) { alert("Could not archive listing. Please try again."); return; }
      await load();
    } finally { setArchiving(null); }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <SellerLayout>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl text-charcoal">Listings</h1>
          <p className="mt-1 text-sm text-muted">
            {data ? `${data.total} product${data.total !== 1 ? "s" : ""}` : ""}
          </p>
        </div>
        <Link
          href="/seller/listings/new"
          className="rounded-md bg-gold px-4 py-2.5 text-sm font-semibold text-white transition-all duration-150 hover:bg-goldDark hover:shadow-card"
        >
          + New listing
        </Link>
      </div>

      {/* Filters */}
      <div className="mt-5 flex gap-2">
        {["all", "active", "draft", "archived"].map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`rounded-md border px-3 py-1.5 text-xs capitalize transition-all duration-150 ${
              statusFilter === s
                ? "border-gold bg-gold/10 font-medium text-gold"
                : "border-ivoryBorder text-muted hover:border-goldDark/20 hover:text-charcoal"
            }`}
          >
            {s === "all" ? "All" : s}
          </button>
        ))}
      </div>

      {error && (
        <p className="mt-4 rounded-sm border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}

      {loading ? (
        <div className="mt-6 space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-md bg-ivoryDark" />
          ))}
        </div>
      ) : data?.products.length === 0 ? (
        <div className="mt-12 flex flex-col items-center rounded-md border border-dashed border-ivoryBorder bg-white/50 py-16 text-center">
          <p className="text-sm text-muted">No listings yet.</p>
          <Link
            href="/seller/listings/new"
            className="mt-4 rounded-md bg-gold px-5 py-2 text-sm font-semibold text-white transition-all duration-150 hover:bg-goldDark hover:shadow-card"
          >
            Create your first listing
          </Link>
        </div>
      ) : (
        <div className="mt-4 overflow-hidden rounded-md border border-ivoryBorder bg-white shadow-card">
          <table className="w-full text-sm">
            <thead className="border-b border-ivoryBorder bg-ivoryDark">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted">Product</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted">Price</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted">Stock</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ivoryBorder">
              {data?.products.map((listing) => (
                <tr key={listing.id} className="transition-colors duration-150 hover:bg-ivory">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {listing.images[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={listing.images[0].url}
                          alt={listing.images[0].altText ?? listing.name}
                          className="h-10 w-10 flex-shrink-0 rounded-md border border-ivoryBorder object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-ivoryDark text-xs text-subtle">
                          No img
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-medium text-charcoal">{listing.name}</p>
                        <p className="text-xs text-subtle">{listing.category?.name ?? "Uncategorised"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[listing.status]}`}>
                      {listing.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-charcoal">
                    PKR {listing.price.toLocaleString()}
                  </td>
                  <td className={`px-4 py-3 text-right tabular-nums ${listing.stockQty === 0 ? "text-red-500" : listing.stockQty < 5 ? "text-amber-600" : "text-charcoal"}`}>
                    {listing.stockQty}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Link
                        href={`/seller/listings/${listing.id}/edit`}
                        className="rounded-sm px-2 py-1 text-xs font-medium text-gold transition-colors duration-150 hover:bg-gold/10"
                      >
                        Edit
                      </Link>
                      <Link
                        href={`/product/${listing.slug}`}
                        target="_blank"
                        className="rounded-sm px-2 py-1 text-xs font-medium text-muted transition-colors duration-150 hover:bg-ivoryDark hover:text-charcoal"
                      >
                        View
                      </Link>
                      {listing.status !== "archived" && (
                        <button
                          onClick={() => handleArchive(listing.id, listing.name)}
                          disabled={archiving === listing.id}
                          className="rounded-sm px-2 py-1 text-xs font-medium text-muted transition-colors duration-150 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                        >
                          {archiving === listing.id ? "Archiving…" : "Archive"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-md border border-ivoryBorder px-3 py-1.5 text-xs text-muted transition-colors duration-150 hover:border-goldDark/20 hover:text-charcoal disabled:opacity-40 disabled:hover:border-ivoryBorder"
          >
            ← Prev
          </button>
          <span className="text-xs text-muted">Page {page} of {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="rounded-md border border-ivoryBorder px-3 py-1.5 text-xs text-muted transition-colors duration-150 hover:border-goldDark/20 hover:text-charcoal disabled:opacity-40 disabled:hover:border-ivoryBorder"
          >
            Next →
          </button>
        </div>
      )}
    </SellerLayout>
  );
}
