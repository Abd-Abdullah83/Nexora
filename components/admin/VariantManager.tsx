"use client";

import { useState, useEffect, useCallback } from "react";

interface CategoryAttribute {
  id: string;
  name: string;
  key: string;
  type: "select" | "color" | "number";
  options: string[] | { name: string; hex: string }[];
  unit?: string | null;
  isRequired: boolean;
}

interface Variant {
  id: string;
  name: string;
  sku: string;
  price: string | null; // Decimal serializes as string over JSON
  stockQty: number;
  weightGrams: number | null;
  attributeValues: Record<string, string | number>;
  isActive: boolean;
}

function getCsrfToken(): string {
  return (
    document.cookie
      .split("; ")
      .find((c) => c.startsWith("csrf_token="))
      ?.split("=")[1] ?? ""
  );
}

export function VariantManager({
  productId,
  categoryId,
  basePrice,
  baseCurrency,
}: {
  productId: string;
  categoryId: string;
  basePrice: string;
  baseCurrency: string;
}) {
  const [attributeDefs, setAttributeDefs] = useState<CategoryAttribute[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // New variant form state
  const [values, setValues] = useState<Record<string, string>>({});
  const [overridePrice, setOverridePrice] = useState("");
  const [sku, setSku] = useState("");
  const [stockQty, setStockQty] = useState("0");
  const [weightGrams, setWeightGrams] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [attrRes, variantRes] = await Promise.all([
      fetch(`/api/admin/categories/${categoryId}/attributes`),
      fetch(`/api/admin/products/${productId}/variants`),
    ]);
    const attrData = await attrRes.json();
    const variantData = await variantRes.json();
    if (attrRes.ok) setAttributeDefs(attrData.attributes);
    if (variantRes.ok) setVariants(variantData.variants);
    setLoading(false);
  }, [categoryId, productId]);

  useEffect(() => {
    load();
  }, [load]);

  function describeAttributeValues(av: Record<string, string | number>): string {
    return attributeDefs
      .map((def) => (av[def.key] !== undefined ? `${def.name}: ${av[def.key]}` : null))
      .filter(Boolean)
      .join(" / ");
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);

    // Build attributeValues, coercing "number" type fields to actual numbers
    const attributeValues: Record<string, string | number> = {};
    for (const def of attributeDefs) {
      const raw = values[def.key];
      if (raw === undefined || raw === "") continue;
      attributeValues[def.key] = def.type === "number" ? Number(raw) : raw;
    }

    try {
      const res = await fetch(`/api/admin/products/${productId}/variants`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": getCsrfToken(),
        },
        body: JSON.stringify({
          name: describeAttributeValues(attributeValues) || sku,
          sku,
          price: overridePrice ? Number(overridePrice) : null,
          stockQty: Number(stockQty),
          weightGrams: weightGrams ? Number(weightGrams) : null,
          attributeValues,
          isActive: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message || "Failed to create variant.");
        return;
      }
      setValues({});
      setOverridePrice("");
      setSku("");
      setStockQty("0");
      setWeightGrams("");
      load();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(variantId: string) {
    if (!confirm("Remove this variant? It will no longer be purchasable.")) return;
    await fetch(`/api/admin/products/${productId}/variants/${variantId}`, {
      method: "DELETE",
      headers: { "x-csrf-token": getCsrfToken() },
    });
    load();
  }

  if (loading) {
    return (
      <div className="rounded-sm border border-white/[0.08] bg-surface p-4">
        <p className="text-sm text-slate">Loading variants…</p>
      </div>
    );
  }

  if (attributeDefs.length === 0) {
    return (
      <div className="rounded-sm border border-white/[0.08] bg-surface p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-brass">Variants</h3>
        <p className="mt-2 text-sm text-slate/60">
          This product&apos;s category has no variant attributes defined yet. Go to{" "}
          <span className="text-brass">Admin → Categories</span> and add attributes (like Size or
          Color) to this category first.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-sm border border-white/[0.08] bg-surface p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-brass">Variants</h3>
      <p className="mt-1 text-xs text-slate/60">
        Each variant has its own price (optional — leave blank to use the base price) and its own
        stock count.
      </p>

      {variants.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-slate">
              <tr>
                <th className="py-2 pr-3">Variant</th>
                <th className="py-2 pr-3">SKU</th>
                <th className="py-2 pr-3">Price</th>
                <th className="py-2 pr-3">Stock</th>
                <th className="py-2 pr-3">Weight</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {variants.map((v) => (
                <tr key={v.id} className="border-t border-white/[0.06] text-cream">
                  <td className="py-2 pr-3">{v.name}</td>
                  <td className="py-2 pr-3 text-slate/70">{v.sku}</td>
                  <td className="py-2 pr-3">
                    {v.price ? `${baseCurrency} ${Number(v.price).toFixed(2)}` : "— (base)"}
                  </td>
                  <td className="py-2 pr-3">{v.stockQty}</td>
                  <td className="py-2 pr-3">{v.weightGrams ? `${v.weightGrams}g` : "—"}</td>
                  <td className="py-2">
                    <button
                      onClick={() => handleDelete(v.id)}
                      className="text-xs text-red-300 hover:text-red-200"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form onSubmit={handleCreate} className="mt-4 flex flex-col gap-3 border-t border-white/[0.06] pt-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {attributeDefs.map((def) => (
            <div key={def.id}>
              <label className="mb-1 block text-xs uppercase tracking-wider text-slate">
                {def.name}
                {def.isRequired && <span className="text-red-400"> *</span>}
                {def.unit && <span className="normal-case text-slate/50"> ({def.unit})</span>}
              </label>

              {def.type === "number" ? (
                <input
                  type="number"
                  value={values[def.key] ?? ""}
                  onChange={(e) => setValues((p) => ({ ...p, [def.key]: e.target.value }))}
                  required={def.isRequired}
                  className="w-full rounded-sm border border-white/10 bg-ink/40 px-3 py-2 text-sm text-cream outline-none focus:border-brass/50"
                />
              ) : def.type === "color" ? (
                <div className="flex flex-wrap gap-2">
                  {(def.options as { name: string; hex: string }[]).map((opt) => (
                    <button
                      key={opt.name}
                      type="button"
                      onClick={() => setValues((p) => ({ ...p, [def.key]: opt.name }))}
                      title={opt.name}
                      className={`h-8 w-8 rounded-full border-2 transition ${values[def.key] === opt.name ? "border-brass" : "border-white/20"
                        }`}
                      style={{ backgroundColor: opt.hex }}
                    />
                  ))}
                </div>
              ) : (
                <select
                  value={values[def.key] ?? ""}
                  onChange={(e) => setValues((p) => ({ ...p, [def.key]: e.target.value }))}
                  required={def.isRequired}
                  className="w-full rounded-sm border border-white/10 bg-ink/40 px-3 py-2 text-sm text-cream outline-none focus:border-brass/50"
                >
                  <option value="">Select…</option>
                  {(def.options as string[]).map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wider text-slate">SKU</label>
            <input
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              required
              className="w-full rounded-sm border border-white/10 bg-ink/40 px-3 py-2 text-sm text-cream outline-none focus:border-brass/50"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wider text-slate">
              Price override <span className="normal-case text-slate/50">(optional)</span>
            </label>
            <input
              type="number"
              placeholder={basePrice}
              value={overridePrice}
              onChange={(e) => setOverridePrice(e.target.value)}
              className="w-full rounded-sm border border-white/10 bg-ink/40 px-3 py-2 text-sm text-cream outline-none focus:border-brass/50"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wider text-slate">Stock qty</label>
            <input
              type="number"
              value={stockQty}
              onChange={(e) => setStockQty(e.target.value)}
              required
              className="w-full rounded-sm border border-white/10 bg-ink/40 px-3 py-2 text-sm text-cream outline-none focus:border-brass/50"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wider text-slate">
              Weight (g) <span className="normal-case text-slate/50">(optional)</span>
            </label>
            <input
              type="number"
              value={weightGrams}
              onChange={(e) => setWeightGrams(e.target.value)}
              className="w-full rounded-sm border border-white/10 bg-ink/40 px-3 py-2 text-sm text-cream outline-none focus:border-brass/50"
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-300">{error}</p>}

        <button
          type="submit"
          disabled={creating}
          className="w-fit rounded-sm bg-brass px-4 py-2 text-sm font-semibold uppercase tracking-wider text-ink hover:bg-brassLight disabled:opacity-50"
        >
          {creating ? "Adding…" : "Add Variant"}
        </button>
      </form>
    </div>
  );
}
