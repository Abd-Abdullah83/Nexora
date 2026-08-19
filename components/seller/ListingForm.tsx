"use client";

// components/seller/ListingForm.tsx
// Shared form for creating and editing a seller product listing.
// Used by /seller/listings/new and /seller/listings/[id]/edit.

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface CategoryOption {
  id: string;
  name: string;
  level: number;
}

interface ListingFormData {
  name: string;
  description: string;
  shortDescription: string;
  price: string;
  comparePrice: string;
  salePrice: string;
  saleEndsAt: string;
  categoryId: string;
  sku: string;
  stockQty: string;
  weightGrams: string;
  status: "draft" | "active" | "archived";
  tags: string;
  currency: string;
  videoUrl: string;
  metaTitle: string;
  metaDescription: string;
}

const EMPTY: ListingFormData = {
  name: "", description: "", shortDescription: "", price: "",
  comparePrice: "", salePrice: "", saleEndsAt: "", categoryId: "",
  sku: "", stockQty: "0", weightGrams: "", status: "draft", tags: "",
  currency: "PKR", videoUrl: "", metaTitle: "", metaDescription: "",
};

const CURRENCIES = ["PKR", "USD", "GBP", "EUR", "AED", "SAR"];

function getCsrf() {
  return document.cookie
    .split("; ")
    .find((c) => c.startsWith("csrf_token="))
    ?.split("=")[1] ?? "";
}

function calcDiscount(price: string, salePrice: string): number | null {
  const p = Number(price);
  const s = Number(salePrice);
  if (!p || !s || s >= p) return null;
  return Math.round(((p - s) / p) * 100);
}

function categoryLabel(name: string, level: number): string {
  if (level === 0) return name;
  const prefix = Array(level).fill("—").join("") + " ";
  return prefix + name;
}

function toPayload(form: ListingFormData) {
  return {
    name: form.name,
    description: form.description,
    shortDescription: form.shortDescription || undefined,
    price: Number(form.price),
    comparePrice: form.comparePrice ? Number(form.comparePrice) : null,
    salePrice: form.salePrice ? Number(form.salePrice) : null,
    saleEndsAt: form.saleEndsAt ? new Date(form.saleEndsAt).toISOString() : null,
    categoryId: form.categoryId,
    sku: form.sku || undefined,
    stockQty: Number(form.stockQty),
    weightGrams: form.weightGrams ? Number(form.weightGrams) : null,
    status: form.status,
    tags: form.tags
      ? form.tags.split(",").map((t) => t.trim()).filter(Boolean)
      : [],
    currency: form.currency,
    videoUrl: form.videoUrl || null,
    metaTitle: form.metaTitle || null,
    metaDescription: form.metaDescription || null,
  };
}

interface Props {
  mode: "create" | "edit";
  listingId?: string;
  initial?: Partial<ListingFormData>;
}

export function ListingForm({ mode, listingId, initial }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<ListingFormData>({ ...EMPTY, ...initial });
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [trustNotice, setTrustNotice] = useState<string | null>(null);

  // Load flat category list for the dropdown
  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((d) => setCategories(d.categories ?? []))
      .catch(() => {});
  }, []);

  // Load seller trust standing so we can warn before submitting
  useEffect(() => {
    fetch("/api/sellers/trust-standing")
      .then((r) => r.json())
      .then((d) => {
        const s = d.standing;
        if (!s) return;
        if (!s.isTrustedSeller) {
          const remaining = Math.max(0, s.trustThreshold - s.approvedListingCount);
          if (remaining > 0) {
            setTrustNotice(
              `Your listings go to admin review before going live. ${s.approvedListingCount} of ${s.trustThreshold} required approvals completed — ${remaining} more needed before you can publish instantly.`
            );
          }
        }
      })
      .catch(() => {});
  }, []);

  function set(key: keyof ListingFormData, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setFieldErrors((e) => {
      const n = { ...e };
      delete n[key];
      return n;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setFieldErrors({});

    try {
      const url =
        mode === "create"
          ? "/api/sellers/listings"
          : `/api/sellers/listings/${listingId}`;
      const method = mode === "create" ? "POST" : "PUT";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": getCsrf(),
        },
        body: JSON.stringify(toPayload(form)),
      });
      const json = await res.json();

      if (!res.ok) {
        if (json.error?.details?.fieldErrors) {
          const fe: Record<string, string> = {};
          for (const [k, v] of Object.entries(
            json.error.details.fieldErrors as Record<string, string[]>
          )) {
            if (v[0]) fe[k] = v[0];
          }
          setFieldErrors(fe);
        } else {
          setError(json.error?.message ?? "Save failed. Please check your inputs.");
        }
        return;
      }

      const id = json.product?.id ?? listingId;

      // Upload primary image if one was selected
      if (imageFile && id) {
        setUploadingImage(true);
        const fd = new FormData();
        fd.append("file", imageFile);
        fd.append("isPrimary", "true");
        await fetch(`/api/sellers/listings/${id}/images`, {
          method: "POST",
          headers: { "x-csrf-token": getCsrf() },
          body: fd,
        });
        setUploadingImage(false);
      }

      router.push("/seller/listings");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
      setUploadingImage(false);
    }
  }

  const isWorking = saving || uploadingImage;
  const discountPreview = calcDiscount(form.price, form.salePrice);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {/* Global errors */}
      {error && (
        <div className="rounded-sm border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Listing approval trust notice */}
      {trustNotice && (
        <div className="rounded-sm border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span className="font-medium">Review required: </span>{trustNotice}
        </div>
      )}

      {/* ── Section 1: Basic information ────────────────────────────── */}
      <Section title="Basic information">
        <Field label="Product name *" error={fieldErrors.name}>
          <input
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="e.g. Handwoven Wool Throw Blanket"
            className={fieldClass(!!fieldErrors.name)}
          />
        </Field>

        <Field label="Description *" error={fieldErrors.description}>
          <textarea
            value={form.description}
            rows={6}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Describe your product — materials, dimensions, care instructions…"
            className={`${fieldClass(!!fieldErrors.description)} resize-y`}
          />
        </Field>

        <Field
          label="Short description"
          error={fieldErrors.shortDescription}
          hint="Shown on product cards. Leave blank to auto-use the start of the description."
        >
          <input
            value={form.shortDescription}
            onChange={(e) => set("shortDescription", e.target.value)}
            maxLength={300}
            className={fieldClass(!!fieldErrors.shortDescription)}
          />
        </Field>

        <Field label="Category *" error={fieldErrors.categoryId}>
          <select
            value={form.categoryId}
            onChange={(e) => set("categoryId", e.target.value)}
            className={fieldClass(!!fieldErrors.categoryId)}
          >
            <option value="">— Select a category —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {categoryLabel(c.name, c.level)}
              </option>
            ))}
          </select>
        </Field>
      </Section>

      {/* ── Section 2: Pricing & stock ──────────────────────────────── */}
      <Section title="Pricing & stock">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Currency" error={fieldErrors.currency}>
            <select
              value={form.currency}
              onChange={(e) => set("currency", e.target.value)}
              className={fieldClass(!!fieldErrors.currency)}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Base price *" error={fieldErrors.price}>
            <input
              type="number"
              min="0"
              step="1"
              value={form.price}
              onChange={(e) => set("price", e.target.value)}
              placeholder="0"
              className={fieldClass(!!fieldErrors.price)}
            />
          </Field>

          <Field
            label="Compare price"
            error={fieldErrors.comparePrice}
            hint="Original / RRP — shown crossed out."
          >
            <input
              type="number"
              min="0"
              step="1"
              value={form.comparePrice}
              onChange={(e) => set("comparePrice", e.target.value)}
              placeholder="0"
              className={fieldClass(!!fieldErrors.comparePrice)}
            />
          </Field>
        </div>

        {/* Sale / discount block */}
        <div className="rounded-sm border border-gold/25 bg-gold/5 p-4 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-goldDark">
              Sale / Discount
            </h3>
            {discountPreview !== null && (
              <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-600">
                {discountPreview}% OFF
              </span>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Field label="Sale price" error={fieldErrors.salePrice}>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.salePrice}
                  onChange={(e) => set("salePrice", e.target.value)}
                  placeholder="0"
                  className={fieldClass(!!fieldErrors.salePrice)}
                />
              </Field>
              <p className="mt-1 text-xs text-muted">
                Leave empty for no sale. Must be less than base price.
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-charcoal">
                Sale ends at{" "}
                <span className="font-normal text-muted">(optional)</span>
              </label>
              <input
                type="datetime-local"
                value={form.saleEndsAt}
                onChange={(e) => set("saleEndsAt", e.target.value)}
                className={fieldClass(false)}
              />
              <p className="mt-1 text-xs text-muted">
                Sale auto-expires at this date/time.
              </p>
            </div>
          </div>

          {/* Live discount preview */}
          {form.salePrice && Number(form.salePrice) > 0 && Number(form.price) > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-sm border border-ivoryBorder bg-white px-4 py-3">
              <span className="text-sm font-bold text-goldDark">
                {form.currency} {Number(form.salePrice).toFixed(2)}
              </span>
              {Number(form.salePrice) < Number(form.price) && (
                <span className="text-sm text-muted line-through">
                  {form.currency} {Number(form.price).toFixed(2)}
                </span>
              )}
              {discountPreview !== null && (
                <span className="ml-auto text-xs font-semibold text-red-600">
                  Save {discountPreview}%
                </span>
              )}
              {form.saleEndsAt && (
                <span className="text-xs text-muted">
                  · Ends {new Date(form.saleEndsAt).toLocaleDateString()}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Stock, SKU, weight */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Stock quantity *" error={fieldErrors.stockQty}>
            <input
              type="number"
              min="0"
              step="1"
              value={form.stockQty}
              onChange={(e) => set("stockQty", e.target.value)}
              className={fieldClass(!!fieldErrors.stockQty)}
            />
          </Field>

          <Field
            label="SKU"
            error={fieldErrors.sku}
            hint="Your internal product code."
          >
            <input
              value={form.sku}
              onChange={(e) => set("sku", e.target.value)}
              placeholder="e.g. WOOL-THROW-01"
              className={fieldClass(!!fieldErrors.sku)}
            />
          </Field>

          <Field label="Weight (grams)" error={fieldErrors.weightGrams}>
            <input
              type="number"
              min="0"
              step="1"
              value={form.weightGrams}
              onChange={(e) => set("weightGrams", e.target.value)}
              placeholder="e.g. 500"
              className={fieldClass(!!fieldErrors.weightGrams)}
            />
          </Field>
        </div>
      </Section>

      {/* ── Section 3: Product image ─────────────────────────────────── */}
      <Section title="Product image">
        <Field
          label="Primary image"
          hint="JPEG, PNG or WebP — max 5 MB. You can add more images after saving."
        >
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
            className="w-full rounded-sm border border-ivoryBorder px-3 py-2 text-sm text-charcoal file:mr-3 file:rounded-sm file:border-0 file:bg-gold/10 file:px-3 file:py-1 file:text-xs file:font-medium file:text-gold hover:file:bg-gold/20"
          />
        </Field>

        <Field
          label="Product video URL"
          error={fieldErrors.videoUrl}
          hint="Optional YouTube or Vimeo link shown on the product page."
        >
          <input
            type="url"
            value={form.videoUrl}
            onChange={(e) => set("videoUrl", e.target.value)}
            placeholder="https://youtube.com/watch?v=..."
            className={fieldClass(!!fieldErrors.videoUrl)}
          />
        </Field>
      </Section>

      {/* ── Section 4: Tags & SEO ────────────────────────────────────── */}
      <Section title="Tags & SEO (optional)">
        <Field label="Tags" hint='Comma-separated — e.g. "handmade, wool, home decor"'>
          <input
            value={form.tags}
            onChange={(e) => set("tags", e.target.value)}
            placeholder="handmade, wool, winter"
            className={fieldClass(false)}
          />
        </Field>

        <Field label="Meta title" error={fieldErrors.metaTitle}>
          <input
            value={form.metaTitle}
            onChange={(e) => set("metaTitle", e.target.value)}
            maxLength={255}
            className={fieldClass(!!fieldErrors.metaTitle)}
          />
        </Field>

        <Field label="Meta description" error={fieldErrors.metaDescription}>
          <textarea
            value={form.metaDescription}
            rows={2}
            onChange={(e) => set("metaDescription", e.target.value)}
            maxLength={500}
            className={`${fieldClass(!!fieldErrors.metaDescription)} resize-none`}
          />
        </Field>
      </Section>

      {/* ── Footer: status + submit ─────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-4 rounded-sm border border-ivoryBorder bg-white p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">
            Listing status
          </label>
          <select
            value={form.status}
            onChange={(e) =>
              set("status", e.target.value as "draft" | "active" | "archived")
            }
            className={`${fieldClass(false)} w-auto`}
          >
            <option value="draft">Draft — not visible to buyers</option>
            <option value="active">Submit for review / Publish</option>
            <option value="archived">Archived — hidden from store</option>
          </select>
          {form.status === "active" && trustNotice && (
            <p className="mt-1 text-xs text-amber-600">
              Will go to admin review first.
            </p>
          )}
        </div>

        <div className="ml-auto flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/seller/listings")}
            className="rounded-sm px-3 py-2 text-sm text-muted transition hover:bg-ivoryDark hover:text-charcoal"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isWorking}
            className="rounded-sm bg-gold px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-goldDark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isWorking
              ? uploadingImage
                ? "Uploading image…"
                : "Saving…"
              : mode === "create"
              ? "Create listing"
              : "Save changes"}
          </button>
        </div>
      </div>
    </form>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────

function fieldClass(hasError = false): string {
  return [
    "w-full rounded-sm border px-3 py-2 text-sm text-charcoal outline-none transition",
    "focus:ring-2 focus:ring-offset-1",
    hasError
      ? "border-red-300 bg-red-50/30 focus:border-red-400 focus:ring-red-100"
      : "border-ivoryBorder bg-white focus:border-gold focus:ring-gold/20",
  ].join(" ");
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-sm border border-ivoryBorder bg-white p-6">
      <h2 className="mb-4 font-display text-base text-charcoal">{title}</h2>
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  children,
  error,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
  hint?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-charcoal">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p className="mt-1 text-xs text-muted">{hint}</p>
      )}
      {error && (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}