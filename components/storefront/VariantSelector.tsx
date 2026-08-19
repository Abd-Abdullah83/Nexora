"use client";

interface VariantOption {
  id: string;
  name: string;
  sku: string;
  price: string | null;
  stockQty: number;
  weightGrams: number | null;
  attributeValues: Record<string, string | number>;
  isActive: boolean;
}

interface AttributeDef {
  id: string;
  name: string;
  key: string;
  type: "select" | "color" | "number";
  options: string[] | { name: string; hex: string }[];
  unit?: string | null;
}

interface VariantSelectorProps {
  attributeDefs: AttributeDef[];
  variants: VariantOption[];
  selectedValues: Record<string, string>;
  onChange: (key: string, value: string) => void;
}

/**
 * Renders one picker per attribute (Size, Color, etc.) and lets the parent
 * track selected values. The parent is responsible for resolving the full
 * selectedValues set to a matching VariantOption (see resolveVariant below)
 * and passing that variant's id + stock into AddToCartButton.
 */
export function VariantSelector({
  attributeDefs,
  variants,
  selectedValues,
  onChange,
}: VariantSelectorProps) {
  if (attributeDefs.length === 0 || variants.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      {attributeDefs.map((def) => {
        // Only offer values that exist on at least one active variant —
        // avoids showing a "Size: XS" option with zero matching variants.
        const availableValues = Array.from(
          new Set(
            variants
              .filter((v) => v.isActive)
              .map((v) => v.attributeValues[def.key])
              .filter((v): v is string | number => v !== undefined)
          )
        );

        return (
          <div key={def.id}>
            <label className="mb-2 block text-xs uppercase tracking-wider text-slate">
              {def.name}
              {def.unit && <span className="normal-case text-slate/50"> ({def.unit})</span>}
            </label>

            {def.type === "color" ? (
              <div className="flex flex-wrap gap-2">
                {(def.options as { name: string; hex: string }[])
                  .filter((opt) => availableValues.includes(opt.name))
                  .map((opt) => (
                    <button
                      key={opt.name}
                      type="button"
                      onClick={() => onChange(def.key, opt.name)}
                      title={opt.name}
                      aria-label={opt.name}
                      className={`h-9 w-9 rounded-full border-2 transition ${selectedValues[def.key] === opt.name
                          ? "border-brass"
                          : "border-white/20 hover:border-white/40"
                        }`}
                      style={{ backgroundColor: opt.hex }}
                    />
                  ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {availableValues.map((val) => (
                  <button
                    key={String(val)}
                    type="button"
                    onClick={() => onChange(def.key, String(val))}
                    className={`rounded-sm border px-3 py-1.5 text-sm transition ${selectedValues[def.key] === String(val)
                        ? "border-brass bg-brass/10 text-brass"
                        : "border-white/10 text-slate hover:border-brass/40 hover:text-cream"
                      }`}
                  >
                    {val}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Finds the single variant matching every selected attribute value.
 * Returns null if the selection is incomplete or no variant matches.
 */
export function resolveVariant(
  variants: VariantOption[],
  attributeDefs: AttributeDef[],
  selectedValues: Record<string, string>
): VariantOption | null {
  const requiredKeys = attributeDefs.map((d) => d.key);
  const allSelected = requiredKeys.every((k) => selectedValues[k]);
  if (!allSelected) return null;

  return (
    variants.find(
      (v) =>
        v.isActive &&
        requiredKeys.every((k) => String(v.attributeValues[k]) === selectedValues[k])
    ) ?? null
  );
}
