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
  displayOrder: number;
}

function getCsrfToken(): string {
  return (
    document.cookie
      .split("; ")
      .find((c) => c.startsWith("csrf_token="))
      ?.split("=")[1] ?? ""
  );
}

function slugifyKey(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function CategoryAttributeManager({ categoryId }: { categoryId: string }) {
  const [attributes, setAttributes] = useState<CategoryAttribute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [name, setName] = useState("");
  const [type, setType] = useState<"select" | "color" | "number">("select");
  const [optionsText, setOptionsText] = useState(""); // comma-separated for select; "Name:#hex" lines for color
  const [unit, setUnit] = useState("");
  const [isRequired, setIsRequired] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/categories/${categoryId}/attributes`);
    const data = await res.json();
    if (res.ok) setAttributes(data.attributes);
    setLoading(false);
  }, [categoryId]);

  useEffect(() => {
    load();
  }, [load]);

  function parseOptions(): unknown[] {
    if (type === "number") return [];
    if (type === "color") {
      // Each line: "Red:#D85A30"
      return optionsText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [optName, hex] = line.split(":").map((s) => s.trim());
          return { name: optName, hex };
        });
    }
    // select: comma-separated
    return optionsText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);

    try {
      const res = await fetch(`/api/admin/categories/${categoryId}/attributes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": getCsrfToken(),
        },
        body: JSON.stringify({
          name,
          key: slugifyKey(name),
          type,
          options: parseOptions(),
          unit: unit || undefined,
          isRequired,
          displayOrder: attributes.length,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message || "Failed to create attribute.");
        return;
      }
      setName("");
      setOptionsText("");
      setUnit("");
      setIsRequired(true);
      load();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this attribute? Existing variants using it will keep their stored values but it won't be selectable for new ones.")) return;
    await fetch(`/api/admin/categories/${categoryId}/attributes/${id}`, {
      method: "DELETE",
      headers: { "x-csrf-token": getCsrfToken() },
    });
    load();
  }

  return (
    <div className="rounded-sm border border-white/[0.08] bg-surface p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-brass">
        Variant attributes
      </h3>
      <p className="mt-1 text-xs text-slate/60">
        Define what options products in this category can have — e.g. Size, Color, Volume.
      </p>

      {loading ? (
        <p className="mt-3 text-sm text-slate">Loading…</p>
      ) : attributes.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-2">
          {attributes.map((attr) => (
            <li
              key={attr.id}
              className="flex items-center justify-between rounded-sm border border-white/[0.06] bg-ink/30 px-3 py-2 text-sm"
            >
              <div>
                <span className="text-cream">{attr.name}</span>
                <span className="ml-2 text-xs text-slate/50">
                  {attr.type}
                  {attr.unit ? ` (${attr.unit})` : ""}
                  {attr.type !== "number" &&
                    ` — ${attr.options
                      .map((o) => (typeof o === "string" ? o : o.name))
                      .join(", ")}`}
                </span>
              </div>
              <button
                onClick={() => handleDelete(attr.id)}
                className="text-xs text-red-300 hover:text-red-200"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-slate/50">
          No attributes defined yet — products in this category won&apos;t have variants until you add some.
        </p>
      )}

      <form onSubmit={handleCreate} className="mt-4 flex flex-col gap-3 border-t border-white/[0.06] pt-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wider text-slate">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Size"
              required
              className="w-full rounded-sm border border-white/10 bg-ink/40 px-3 py-2 text-sm text-cream outline-none focus:border-brass/50"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wider text-slate">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as typeof type)}
              className="w-full rounded-sm border border-white/10 bg-ink/40 px-3 py-2 text-sm text-cream outline-none focus:border-brass/50"
            >
              <option value="select">Select (dropdown)</option>
              <option value="color">Color (swatches)</option>
              <option value="number">Number (with unit)</option>
            </select>
          </div>
          {type === "number" ? (
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wider text-slate">Unit</label>
              <input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="ml"
                className="w-full rounded-sm border border-white/10 bg-ink/40 px-3 py-2 text-sm text-cream outline-none focus:border-brass/50"
              />
            </div>
          ) : (
            <div className="flex items-end pb-2">
              <Checkbox
                label="Required"
                checked={isRequired}
                onChange={(e) => setIsRequired(e.target.checked)}
              />
            </div>
          )}
        </div>

        {type !== "number" && (
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wider text-slate">
              {type === "color" ? "Options — one per line, Name:#hex" : "Options — comma-separated"}
            </label>
            <textarea
              value={optionsText}
              onChange={(e) => setOptionsText(e.target.value)}
              rows={type === "color" ? 3 : 2}
              placeholder={type === "color" ? "Red:#D85A30\nBlue:#378ADD" : "S, M, L, XL"}
              className="w-full rounded-sm border border-white/10 bg-ink/40 px-3 py-2 text-sm text-cream outline-none focus:border-brass/50"
            />
          </div>
        )}

        {error && <p className="text-sm text-red-300">{error}</p>}

        <button
          type="submit"
          disabled={creating || !name}
          className="w-fit rounded-sm bg-brass px-4 py-2 text-sm font-semibold uppercase tracking-wider text-ink hover:bg-brassLight disabled:opacity-50"
        >
          {creating ? "Adding…" : "Add Attribute"}
        </button>
      </form>
    </div>
  );
}

function Checkbox({ label, checked, onChange }: {
  label: string; checked: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-slate">
      <input type="checkbox" checked={checked} onChange={onChange} />
      {label}
    </label>
  );
}
