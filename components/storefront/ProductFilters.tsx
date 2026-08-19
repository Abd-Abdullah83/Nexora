"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "name_asc", label: "Name: A to Z" },
];

export function ProductFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-4 border-b border-white/[0.08] pb-4">
      <div className="flex items-center gap-2">
        <label className="text-xs uppercase tracking-wider text-slate">Sort</label>
        <select
          defaultValue={searchParams.get("sort") || "newest"}
          onChange={(e) => updateParam("sort", e.target.value)}
          className="rounded-sm border border-white/10 bg-surface px-3 py-1.5 text-sm text-cream outline-none focus:border-brass/50"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-xs uppercase tracking-wider text-slate">Min $</label>
        <input
          type="number"
          min={0}
          defaultValue={searchParams.get("minPrice") || ""}
          onBlur={(e) => updateParam("minPrice", e.target.value)}
          className="w-20 rounded-sm border border-white/10 bg-surface px-2 py-1.5 text-sm text-cream outline-none focus:border-brass/50"
        />
      </div>

      <div className="flex items-center gap-2">
        <label className="text-xs uppercase tracking-wider text-slate">Max $</label>
        <input
          type="number"
          min={0}
          defaultValue={searchParams.get("maxPrice") || ""}
          onBlur={(e) => updateParam("maxPrice", e.target.value)}
          className="w-20 rounded-sm border border-white/10 bg-surface px-2 py-1.5 text-sm text-cream outline-none focus:border-brass/50"
        />
      </div>
    </div>
  );
}
