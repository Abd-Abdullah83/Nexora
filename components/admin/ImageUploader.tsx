"use client";

import { useRef, useState } from "react";

interface ProductImage {
  id: string;
  url: string;
  altText?: string | null;
  isPrimary: boolean;
  displayOrder: number;
}

interface ImageUploaderProps {
  productId: string;
  existingImages?: ProductImage[];
  onUploaded?: (image: ProductImage) => void;
  onDeleted?: (imageId: string) => void;
}

function getCsrfToken(): string {
  return (
    document.cookie
      .split("; ")
      .find((c) => c.startsWith("csrf_token="))
      ?.split("=")[1] ?? ""
  );
}

export function ImageUploader({
  productId,
  existingImages = [],
  onUploaded,
  onDeleted,
}: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<ProductImage[]>(existingImages);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function uploadFile(file: File) {
    setError(null);
    setUploading(true);

    const isFirstImage = images.length === 0;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("productId", productId);
    formData.append("isPrimary", String(isFirstImage));

    try {
      const res = await fetch("/api/admin/upload", {
        method: "POST",
        headers: { "x-csrf-token": getCsrfToken() },
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error?.message ?? "Upload failed.");
        return;
      }

      const newImage: ProductImage = data.image;
      setImages((prev) => [...prev, newImage]);
      onUploaded?.(newImage);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(imageId: string) {
    try {
      const res = await fetch(`/api/admin/upload?imageId=${imageId}`, {
        method: "DELETE",
        headers: { "x-csrf-token": getCsrfToken() },
      });

      if (!res.ok) {
        setError("Could not delete image.");
        return;
      }

      setImages((prev) => prev.filter((img) => img.id !== imageId));
      onDeleted?.(imageId);
    } catch {
      setError("Network error.");
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = ""; // reset so the same file can be re-selected
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  }

  return (
    <div className="flex flex-col gap-4">

      {/* ── Existing images grid ── */}
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {[...images]
            .sort((a, b) => a.displayOrder - b.displayOrder)
            .map((img) => (
              <div key={img.id} className="group relative">
                <div className="aspect-square overflow-hidden rounded-sm border border-white/10 bg-surfaceLight">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt={img.altText ?? "Product image"}
                    className="h-full w-full object-cover"
                  />
                </div>

                {/* Primary badge */}
                {img.isPrimary && (
                  <span className="absolute left-1 top-1 rounded-sm bg-brass px-1.5 py-0.5 text-[10px] font-semibold text-ink">
                    Primary
                  </span>
                )}

                {/* Delete button — visible on hover */}
                <button
                  onClick={() => handleDelete(img.id)}
                  className="absolute right-1 top-1 hidden h-6 w-6 items-center justify-center rounded-sm bg-red-600/80 text-xs text-white group-hover:flex"
                  title="Delete image"
                >
                  ✕
                </button>
              </div>
            ))}
        </div>
      )}

      {/* ── Drop zone ── */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-sm border-2 border-dashed p-8 transition ${
          dragOver
            ? "border-brass bg-brass/10"
            : "border-white/20 hover:border-brass/50 hover:bg-white/[0.03]"
        }`}
      >
        {uploading ? (
          <p className="text-sm text-slate">Uploading to Cloudinary…</p>
        ) : (
          <>
            <span className="text-3xl text-slate/30">↑</span>
            <p className="text-sm text-slate">
              Drag & drop or{" "}
              <span className="text-brass underline-offset-2 hover:underline">
                browse files
              </span>
            </p>
            <p className="text-xs text-slate/50">
              JPEG · PNG · WebP · GIF &nbsp;·&nbsp; max 8 MB
            </p>
          </>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Error message */}
      {error && (
        <p className="rounded-sm border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
