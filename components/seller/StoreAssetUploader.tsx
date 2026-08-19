"use client";

// components/seller/StoreAssetUploader.tsx
//
// GAP FIX: native upload widget for store logo/banner — replaces the old
// raw "paste a Cloudinary URL" text input. Uploads go through
// POST /api/sellers/store/upload, which stores the image in this
// project's own Cloudinary account (same one product images already use)
// and updates the Store row directly.

import { useRef, useState } from "react";

interface StoreAssetUploaderProps {
  kind: "logo" | "banner";
  currentUrl: string | null;
  onUpdated: (urls: { logoUrl: string | null; bannerUrl: string | null }) => void;
}

function getCsrf() {
  return document.cookie.split("; ").find((c) => c.startsWith("csrf_token="))?.split("=")[1] ?? "";
}

export function StoreAssetUploader({ kind, currentUrl, onUpdated }: StoreAssetUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const label = kind === "logo" ? "Store Logo" : "Store Banner";
  const hint =
    kind === "logo"
      ? "Square image recommended, at least 200×200px."
      : "Wide image recommended, at least 1200×300px.";

  async function upload(file: File) {
    setError(null);

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Only JPEG, PNG, or WebP images are allowed.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("File must be under 5 MB.");
      return;
    }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", kind);

      const res = await fetch("/api/sellers/store/upload", {
        method: "POST",
        headers: { "x-csrf-token": getCsrf() },
        body: fd,
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error?.message ?? "Upload failed.");
        return;
      }

      onUpdated(data.store);
    } catch {
      setError("Network error during upload.");
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove() {
    setUploading(true);
    setError(null);
    try {
      const res = await fetch(`/api/sellers/store/upload?kind=${kind}`, {
        method: "DELETE",
        headers: { "x-csrf-token": getCsrf() },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? "Could not remove image.");
        return;
      }
      onUpdated(data.store);
    } finally {
      setUploading(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) upload(file);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) upload(file);
  }

  const previewAspect = kind === "logo" ? "aspect-square max-w-[160px]" : "aspect-[4/1] w-full";

  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-charcoal">{label}</label>

      {currentUrl && (
        <div className={`mb-3 overflow-hidden rounded-md border border-ivoryBorder ${previewAspect}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={currentUrl} alt={label} className="h-full w-full object-cover" />
        </div>
      )}

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-md border-2 border-dashed p-5 text-center transition-colors duration-150 ${
          dragOver
            ? "border-gold bg-gold/5"
            : "border-ivoryBorder hover:border-goldDark/40 hover:bg-ivory/40"
        }`}
      >
        {uploading ? (
          <p className="text-sm text-muted">Uploading…</p>
        ) : (
          <>
            <span className="text-xl text-subtle">↑</span>
            <p className="text-sm text-charcoal">
              Drag & drop or <span className="text-gold">browse</span>
            </p>
            <p className="text-xs text-subtle">{hint}</p>
          </>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />

      {currentUrl && !uploading && (
        <button
          type="button"
          onClick={handleRemove}
          className="mt-2 text-xs text-red-600 hover:underline"
        >
          Remove {kind}
        </button>
      )}

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
