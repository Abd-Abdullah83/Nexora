"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { VariantManager } from "@/components/admin/VariantManager";


// ── Types ──────────────────────────────────────────────────────────────────

interface Category {
  id: string;
  name: string;
}

interface ProductImage {
  id: string;
  url: string;
  isPrimary?: boolean;
}

interface ProductFormData {
  name: string;
  description: string;
  shortDescription: string;
  price: string;
  comparePrice: string;
  salePrice: string;
  saleEndsAt: string;        // ISO date string for datetime-local input
  currency: string;
  categoryId: string;
  sku: string;
  stockQty: string;
  status: "draft" | "active" | "archived";
  isFeatured: boolean;
  isBestSeller: boolean;
  isNewArrival: boolean;
  tags: string;
  videoUrl: string;
}

const EMPTY_FORM: ProductFormData = {
  name: "",
  description: "",
  shortDescription: "",
  price: "",
  comparePrice: "",
  salePrice: "",
  saleEndsAt: "",
  currency: "PKR",
  categoryId: "",
  sku: "",
  stockQty: "0",
  status: "draft",
  isFeatured: false,
  isBestSeller: false,
  isNewArrival: false,
  tags: "",
  videoUrl: "",
};

const CURRENCIES = [
  { code: "PKR", label: "PKR — Pakistani Rupee" },
  { code: "USD", label: "USD — US Dollar" },
  { code: "EUR", label: "EUR — Euro" },
  { code: "GBP", label: "GBP — British Pound" },
  { code: "AED", label: "AED — UAE Dirham" },
  { code: "SAR", label: "SAR — Saudi Riyal" },
];

interface ProductFormProps {
  productId?: string;
  initialData?: Partial<ProductFormData>;
  existingImages?: ProductImage[];
}

function getCsrfToken(): string {
  return (
    document.cookie
      .split("; ")
      .find((c) => c.startsWith("csrf_token="))
      ?.split("=")[1] ?? ""
  );
}

// ── Discount preview helper ────────────────────────────────────────────────

function calcDiscount(price: string, salePrice: string): number | null {
  const p = Number(price);
  const s = Number(salePrice);
  if (!p || !s || s >= p) return null;
  return Math.round(((p - s) / p) * 100);
}

// ── Component ──────────────────────────────────────────────────────────────

export function ProductForm({
  productId,
  initialData,
  existingImages = [],
}: ProductFormProps) {
  const router = useRouter();
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<ProductFormData>({ ...EMPTY_FORM, ...initialData });
  const [categories, setCategories] = useState<Category[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const [images, setImages] = useState<ProductImage[]>(existingImages);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((d) => setCategories(d.categories || []));
  }, []);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  // ── Image upload ──────────────────────────────────────────────────────────

  async function uploadFiles(files: FileList | File[]) {
    if (!productId) {
      setImageError("Save the product first before uploading images.");
      return;
    }
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    const fileArray = Array.from(files);
    for (const file of fileArray) {
      if (!allowed.includes(file.type)) { setImageError(`${file.name}: only JPEG, PNG, WebP, GIF allowed.`); return; }
      if (file.size > 8 * 1024 * 1024) { setImageError(`${file.name}: must be under 8 MB.`); return; }
    }
    setImageError(null);
    setUploadingImages(true);
    for (const file of fileArray) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("productId", productId);
      formData.append("isPrimary", String(images.length === 0));
      try {
        const res = await fetch("/api/admin/upload", {
          method: "POST",
          headers: { "x-csrf-token": getCsrfToken() },
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) { setImageError(data.error?.message ?? "Upload failed."); break; }
        setImages((prev) => [...prev, data.image]);
      } catch { setImageError("Network error during upload."); break; }
    }
    setUploadingImages(false);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) uploadFiles(e.target.files);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) uploadFiles(e.dataTransfer.files);
  }

  async function handleDeleteImage(imageId: string) {
    try {
      const res = await fetch(`/api/admin/upload?imageId=${imageId}`, {
        method: "DELETE",
        headers: { "x-csrf-token": getCsrfToken() },
      });
      if (!res.ok) { setImageError("Could not delete image."); return; }
      setImages((prev) => prev.filter((img) => img.id !== imageId));
    } catch { setImageError("Network error."); }
  }

  // ── Form submit ───────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setSaving(true);

    // Validate sale price < base price
    if (form.salePrice && Number(form.salePrice) >= Number(form.price)) {
      setErrors({ salePrice: "Sale price must be less than the base price." });
      setSaving(false);
      return;
    }

    const payload = {
      name: form.name,
      description: form.description,
      shortDescription: form.shortDescription || undefined,
      price: Number(form.price),
      comparePrice: form.comparePrice ? Number(form.comparePrice) : null,
      salePrice: form.salePrice ? Number(form.salePrice) : null,
      saleEndsAt: form.saleEndsAt ? new Date(form.saleEndsAt).toISOString() : null,
      currency: form.currency,
      categoryId: form.categoryId,
      sku: form.sku,
      stockQty: Number(form.stockQty),
      status: form.status,
      isFeatured: form.isFeatured,
      isBestSeller: form.isBestSeller,
      isNewArrival: form.isNewArrival,
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      ...(form.videoUrl.trim() ? { videoUrl: form.videoUrl.trim() } : {}),
    };

    try {
      const url = productId ? `/api/admin/products/${productId}` : "/api/admin/products";
      const method = productId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": getCsrfToken(),
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error?.details?.fieldErrors) {
          const fieldErrors: Record<string, string> = {};
          for (const [key, val] of Object.entries(data.error.details.fieldErrors)) {
            if (Array.isArray(val) && val[0]) fieldErrors[key] = val[0] as string;
          }
          setErrors(fieldErrors);
        } else {
          setErrors({ form: data.error?.message || "Failed to save product." });
        }
        return;
      }
      if (!productId) {
        router.push(`/admin/products/${data.product.id}/edit`);
      } else {
        router.push("/admin/products");
      }
    } catch {
      setErrors({ form: "Network error. Please try again." });
    } finally {
      setSaving(false);
    }
  }

  // Discount preview shown live as admin types
  const discountPreview = calcDiscount(form.price, form.salePrice);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} className="flex max-w-2xl flex-col gap-6">

      {/* Name + SKU */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" name="name" value={form.name} onChange={handleChange} error={errors.name} />
        <Field label="SKU" name="sku" value={form.sku} onChange={handleChange} error={errors.sku} />
      </div>

      {/* Description */}
      <div>
        <label className="mb-1 block text-xs uppercase tracking-wider text-slate">Description</label>
        <textarea
          name="description"
          value={form.description}
          onChange={handleChange}
          rows={4}
          className="w-full rounded-sm border border-white/10 bg-ink/40 px-3 py-2 text-sm text-cream outline-none focus:border-brass/50"
        />
        {errors.description && <p className="mt-1 text-xs text-red-300">{errors.description}</p>}
      </div>

      <Field label="Short description" name="shortDescription" value={form.shortDescription} onChange={handleChange} />

      {/* Currency + Stock */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs uppercase tracking-wider text-slate">Currency</label>
          <select
            name="currency"
            value={form.currency}
            onChange={handleChange}
            className="w-full rounded-sm border border-white/10 bg-ink/40 px-3 py-2 text-sm text-cream outline-none focus:border-brass/50"
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>{c.label}</option>
            ))}
          </select>
        </div>
        <Field label="Stock qty" name="stockQty" type="number" value={form.stockQty} onChange={handleChange} error={errors.stockQty} />
      </div>

      {/* Price + Compare price */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={`Base price (${form.currency})`} name="price" type="number" value={form.price} onChange={handleChange} error={errors.price} />
        <Field label={`Compare price (${form.currency})`} name="comparePrice" type="number" value={form.comparePrice} onChange={handleChange} />
      </div>

      {/* ── Sale / Discount section ── */}
      <div className="rounded-sm border border-brass/20 bg-brass/5 p-4 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-brass">
            Sale / Discount
          </h3>
          {discountPreview !== null && (
            <span className="rounded-full bg-red-500/20 px-2.5 py-0.5 text-xs font-semibold text-red-400">
              {discountPreview}% OFF
            </span>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Field
              label={`Sale price (${form.currency})`}
              name="salePrice"
              type="number"
              value={form.salePrice}
              onChange={handleChange}
              error={errors.salePrice}
            />
            <p className="mt-1 text-xs text-slate/50">
              Leave empty for no sale. Must be less than base price.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-xs uppercase tracking-wider text-slate">
              Sale ends at{" "}
              <span className="normal-case text-slate/50">(optional)</span>
            </label>
            <input
              type="datetime-local"
              name="saleEndsAt"
              value={form.saleEndsAt}
              onChange={handleChange}
              className="w-full rounded-sm border border-white/10 bg-ink/40 px-3 py-2 text-sm text-cream outline-none focus:border-brass/50"
            />
            <p className="mt-1 text-xs text-slate/50">
              Sale auto-expires at this date/time.
            </p>
          </div>
        </div>

        {/* Live preview */}
        {form.salePrice && Number(form.salePrice) > 0 && Number(form.price) > 0 && (
          <div className="flex items-center gap-3 rounded-sm border border-white/[0.08] bg-surface px-4 py-3">
            <span className="text-sm font-semibold text-brass">
              {form.currency} {Number(form.salePrice).toFixed(2)}
            </span>
            {Number(form.salePrice) < Number(form.price) && (
              <span className="text-sm text-slate/60 line-through">
                {form.currency} {Number(form.price).toFixed(2)}
              </span>
            )}
            {discountPreview !== null && (
              <span className="ml-auto text-xs font-semibold text-red-400">
                Save {discountPreview}%
              </span>
            )}
            {form.saleEndsAt && (
              <span className="text-xs text-slate/50">
                · Ends {new Date(form.saleEndsAt).toLocaleDateString()}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Category + Status */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs uppercase tracking-wider text-slate">Category</label>
          <select
            name="categoryId"
            value={form.categoryId}
            onChange={handleChange}
            className="w-full rounded-sm border border-white/10 bg-ink/40 px-3 py-2 text-sm text-cream outline-none focus:border-brass/50"
          >
            <option value="">Select category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {errors.categoryId && <p className="mt-1 text-xs text-red-300">{errors.categoryId}</p>}
        </div>
        <div>
          <label className="mb-1 block text-xs uppercase tracking-wider text-slate">Status</label>
          <select
            name="status"
            value={form.status}
            onChange={handleChange}
            className="w-full rounded-sm border border-white/10 bg-ink/40 px-3 py-2 text-sm text-cream outline-none focus:border-brass/50"
          >
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </div>

      <Field label="Tags (comma-separated)" name="tags" value={form.tags} onChange={handleChange} />

      {/* Flags */}
      <div className="flex gap-5 text-sm text-slate">
        <Checkbox label="Featured" name="isFeatured" checked={form.isFeatured} onChange={handleChange} />
        <Checkbox label="Best seller" name="isBestSeller" checked={form.isBestSeller} onChange={handleChange} />
        <Checkbox label="New arrival" name="isNewArrival" checked={form.isNewArrival} onChange={handleChange} />
      </div>

      {/* Images */}
      {productId ? (
        <div>
          <label className="mb-2 block text-xs uppercase tracking-wider text-slate">Product Images</label>
          {images.length > 0 && (
            <div className="mb-3 grid grid-cols-3 gap-3 sm:grid-cols-4">
              {images.map((img) => (
                <div key={img.id} className="group relative">
                  <div className="aspect-square overflow-hidden rounded-sm border border-white/10 bg-surfaceLight">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url} alt="Product" className="h-full w-full object-cover" />
                  </div>
                  {img.isPrimary && (
                    <span className="absolute left-1 top-1 rounded-sm bg-brass px-1.5 py-0.5 text-[10px] font-semibold text-ink">Primary</span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDeleteImage(img.id)}
                    className="absolute right-1 top-1 hidden h-6 w-6 items-center justify-center rounded-sm bg-red-600/80 text-xs text-white group-hover:flex"
                  >✕</button>
                </div>
              ))}
            </div>
          )}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => imageInputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-sm border-2 border-dashed p-6 transition ${dragOver ? "border-brass bg-brass/10" : "border-white/20 hover:border-brass/40 hover:bg-white/[0.03]"}`}
          >
            {uploadingImages ? (
              <p className="text-sm text-slate">Uploading…</p>
            ) : (
              <>
                <span className="text-2xl text-slate/30">↑</span>
                <p className="text-sm text-slate">Drag & drop or <span className="text-brass">browse</span></p>
                <p className="text-xs text-slate/50">Select multiple files · JPEG, PNG, WebP · max 8 MB each</p>
              </>
            )}
          </div>
          <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple className="hidden" onChange={handleFileInput} />
          {imageError && <p className="mt-2 text-sm text-red-400">{imageError}</p>}
        </div>
      ) : (
        <div className="rounded-sm border border-white/[0.08] bg-surface p-4">
          <p className="text-xs text-slate">📷 Images can be uploaded after the product is created.</p>
        </div>
      )}

      {/* Variants */}
      {productId && form.categoryId ? (
        <VariantManager
          productId={productId}
          categoryId={form.categoryId}
          basePrice={form.price}
          baseCurrency={form.currency}
        />
      ) : (
        <div className="rounded-sm border border-white/[0.08] bg-surface p-4">
          <p className="text-xs text-slate">
            Variants (size, color, etc.) can be added after the product is created and a category is selected.
          </p>
        </div>
      )}
      {/* Video */}
      <div>
        <label className="mb-1 block text-xs uppercase tracking-wider text-slate">
          Product Video <span className="normal-case text-slate/50">(optional)</span>
        </label>
        <input
          type="url"
          name="videoUrl"
          value={form.videoUrl}
          onChange={handleChange}
          placeholder="https://youtube.com/watch?v=..."
          className="w-full rounded-sm border border-white/10 bg-ink/40 px-3 py-2 text-sm text-cream outline-none focus:border-brass/50"
        />
      </div>

      {errors.form && (
        <p className="rounded-sm border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {errors.form}
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="w-fit rounded-sm bg-brass px-6 py-2.5 text-sm font-semibold uppercase tracking-wider text-ink transition hover:bg-brassLight disabled:opacity-50"
      >
        {saving ? "Saving…" : productId ? "Save Changes" : "Create Product"}
      </button>
    </form>
  );
}

function Field({ label, name, value, onChange, error, type = "text" }: {
  label: string; name: string; value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string; type?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs uppercase tracking-wider text-slate">{label}</label>
      <input type={type} name={name} value={value} onChange={onChange}
        className="w-full rounded-sm border border-white/10 bg-ink/40 px-3 py-2 text-sm text-cream outline-none focus:border-brass/50"
      />
      {error && <p className="mt-1 text-xs text-red-300">{error}</p>}
    </div>
  );
}

function Checkbox({ label, name, checked, onChange }: {
  label: string; name: string; checked: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2">
      <input type="checkbox" name={name} checked={checked} onChange={onChange} />
      {label}
    </label>
  );
}
