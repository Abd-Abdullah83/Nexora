"use client";

// GAP FIX: Logo URL / Banner URL raw text inputs replaced with
// StoreAssetUploader — sellers now upload a real file (drag & drop or
// browse) instead of pasting an external Cloudinary link. Everything
// else on this page — name/slug/description/colours/save flow — is
// unchanged from the original.

import { useEffect, useState } from "react";
import { SellerLayout } from "@/components/seller/SellerLayout";
import { StoreAssetUploader } from "@/components/seller/StoreAssetUploader";

function getCsrf() {
  return document.cookie.split("; ").find((c) => c.startsWith("csrf_token="))?.split("=")[1] ?? "";
}

interface Store {
  name: string; slug: string; logoUrl: string | null;
  bannerUrl: string | null; description: string | null;
  themeJson: { primaryColor?: string; accentColor?: string };
}

export default function SellerStorePage() {
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/sellers/store")
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) { setError(json.error?.message ?? "Could not load store."); return; }
        setStore(json.store);
      })
      .catch(() => setError("Network error."))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!store) return;
    setSaving(true); setFieldErrors({}); setError(null);
    try {
      const res = await fetch("/api/sellers/store", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrf() },
        body: JSON.stringify(store),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.error?.details) setFieldErrors(json.error.details);
        else setError(json.error?.message ?? "Save failed.");
        return;
      }
      setStore(json.store);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch { setError("Network error."); }
    finally { setSaving(false); }
  }

  // Called by StoreAssetUploader after a successful upload/remove — updates
  // local state immediately without needing a full page reload.
  function handleAssetUpdated(urls: { logoUrl: string | null; bannerUrl: string | null }) {
    setStore((s) => (s ? { ...s, logoUrl: urls.logoUrl, bannerUrl: urls.bannerUrl } : s));
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <SellerLayout>
      <h1 className="font-display text-2xl text-charcoal">My Store</h1>
      <p className="mt-1 text-sm text-muted">Customize your public storefront page.</p>

      {loading && <div className="mt-6 h-64 animate-pulse rounded-sm bg-ivoryDark" />}
      {error && <p className="mt-4 rounded-sm border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {store && (
        <form onSubmit={handleSave} className="mt-6 flex flex-col gap-5 rounded-sm border border-ivoryBorder bg-white p-6 shadow-card">
          <Field label="Store name" error={fieldErrors.name}>
            <input value={store.name} onChange={(e) => setStore({ ...store, name: e.target.value })}
              className="input-base" placeholder="My Store" />
          </Field>

          <Field label="Store URL (slug)" error={fieldErrors.slug}
            hint={`nexora.com/store/${store.slug ?? ""}`}>
            <input value={store.slug} onChange={(e) => setStore({ ...store, slug: e.target.value.toLowerCase() })}
              className="input-base" placeholder="my-store" />
          </Field>

          <Field label="Short description" error={fieldErrors.description}>
            <textarea value={store.description ?? ""} rows={3}
              onChange={(e) => setStore({ ...store, description: e.target.value || null })}
              className="input-base resize-none" placeholder="Tell buyers what you sell…" />
          </Field>

          {/* GAP FIX: native upload widgets replacing raw URL inputs */}
          <StoreAssetUploader
            kind="logo"
            currentUrl={store.logoUrl}
            onUpdated={handleAssetUpdated}
          />

          <StoreAssetUploader
            kind="banner"
            currentUrl={store.bannerUrl}
            onUpdated={handleAssetUpdated}
          />

          <div className="grid grid-cols-2 gap-4">
            <Field label="Primary colour" error={fieldErrors.themeJson}>
              <input type="color" value={store.themeJson?.primaryColor ?? "#C9A96E"}
                onChange={(e) => setStore({ ...store, themeJson: { ...store.themeJson, primaryColor: e.target.value } })}
                className="h-10 w-full cursor-pointer rounded-sm border border-ivoryBorder" />
            </Field>
            <Field label="Accent colour">
              <input type="color" value={store.themeJson?.accentColor ?? "#1A1A1A"}
                onChange={(e) => setStore({ ...store, themeJson: { ...store.themeJson, accentColor: e.target.value } })}
                className="h-10 w-full cursor-pointer rounded-sm border border-ivoryBorder" />
            </Field>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button type="submit" disabled={saving}
              className="rounded-sm bg-charcoal px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-gold disabled:opacity-50">
              {saving ? "Saving…" : "Save Changes"}
            </button>
            {saved && <p className="text-sm text-emerald">✓ Saved</p>}
          </div>
        </form>
      )}
    </SellerLayout>
  );
}

function Field({ label, children, error, hint }: {
  label: string; children: React.ReactNode; error?: string; hint?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-charcoal">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-subtle">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
