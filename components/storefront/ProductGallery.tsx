"use client";

import { useState, useRef } from "react";

interface GalleryImage {
  id: string;
  url: string;
  altText?: string | null;
}

interface ProductGalleryProps {
  images: GalleryImage[];
  productName: string;
  videoUrl?: string | null;
}

function getEmbedUrl(url: string): string | null {
  if (url.includes("youtube.com") || url.includes("youtu.be")) {
    const match =
      url.match(/[?&]v=([^&#]+)/) ||
      url.match(/youtu\.be\/([^?&#]+)/) ||
      url.match(/embed\/([^?&#]+)/);
    const id = match?.[1];
    return id ? `https://www.youtube.com/embed/${id}?autoplay=0` : null;
  }
  if (url.includes("vimeo.com")) {
    const match = url.match(/vimeo\.com\/(\d+)/);
    const id = match?.[1];
    return id ? `https://player.vimeo.com/video/${id}` : null;
  }
  return url; // direct video file
}

export function ProductGallery({ images, productName, videoUrl }: ProductGalleryProps) {
  // Build media items: images first, then video as last slide
  type MediaItem =
    | { kind: "image"; id: string; url: string; altText?: string | null }
    | { kind: "video"; id: string; url: string };

  const mediaItems: MediaItem[] = [
    ...images.map((img) => ({ kind: "image" as const, ...img })),
    ...(videoUrl ? [{ kind: "video" as const, id: "video", url: videoUrl }] : []),
  ];

  const [activeIndex, setActiveIndex] = useState(0);
  const active = mediaItems[activeIndex];

  // Zoom state
  const [zoomed, setZoomed] = useState(false);
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 });
  const imgRef = useRef<HTMLDivElement>(null);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoomPos({ x, y });
  }

  function prev() {
    setActiveIndex((i) => (i === 0 ? mediaItems.length - 1 : i - 1));
    setZoomed(false);
  }

  function next() {
    setActiveIndex((i) => (i === mediaItems.length - 1 ? 0 : i + 1));
    setZoomed(false);
  }

  function goTo(index: number) {
    setActiveIndex(index);
    setZoomed(false);
  }

  if (mediaItems.length === 0) {
    return (
      <div className="aspect-square flex items-center justify-center rounded-sm border border-white/[0.08] bg-surface text-slate/40">
        No image available
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* ── Main viewer ── */}
      <div className="relative overflow-hidden rounded-sm border border-white/[0.08] bg-surface">

        {active.kind === "image" ? (
          // Image with zoom
          <div
            ref={imgRef}
            className={`aspect-square overflow-hidden ${zoomed ? "cursor-zoom-out" : "cursor-zoom-in"}`}
            onMouseMove={handleMouseMove}
            onMouseEnter={() => setZoomed(true)}
            onMouseLeave={() => setZoomed(false)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={active.url}
              alt={active.altText || productName}
              className="h-full w-full object-cover transition-transform duration-100"
              style={
                zoomed
                  ? {
                    transformOrigin: `${zoomPos.x}% ${zoomPos.y}%`,
                    transform: "scale(2.2)",
                  }
                  : {}
              }
            />
          </div>
        ) : (
          // Video embed
          <div className="aspect-square bg-black">
            {active.url.match(/\.(mp4|webm|ogg)$/i) ? (
              <video
                src={active.url}
                controls
                className="h-full w-full object-contain"
              />
            ) : (
              <iframe
                src={getEmbedUrl(active.url) ?? active.url}
                className="h-full w-full"
                allowFullScreen
                title="Product video"
              />
            )}
          </div>
        )}

        {/* Arrow buttons — only shown when more than 1 item */}
        {mediaItems.length > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-ink/70 text-cream backdrop-blur-sm transition hover:bg-brass hover:text-ink"
              aria-label="Previous"
            >
              ‹
            </button>
            <button
              onClick={next}
              className="absolute right-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-ink/70 text-cream backdrop-blur-sm transition hover:bg-brass hover:text-ink"
              aria-label="Next"
            >
              ›
            </button>
          </>
        )}

        {/* Slide counter badge */}
        {mediaItems.length > 1 && (
          <span className="absolute bottom-2 right-2 rounded-full bg-ink/60 px-2 py-0.5 text-xs text-slate backdrop-blur-sm">
            {activeIndex + 1} / {mediaItems.length}
          </span>
        )}
      </div>

      {/* ── Thumbnails ── */}
      {mediaItems.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {mediaItems.map((item, i) => (
            <button
              key={item.id}
              onClick={() => goTo(i)}
              className={`relative flex-shrink-0 h-16 w-16 overflow-hidden rounded-sm border transition ${i === activeIndex
                  ? "border-brass"
                  : "border-white/10 hover:border-brass/40"
                }`}
            >
              {item.kind === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.url}
                  alt={item.altText || productName}
                  className="h-full w-full object-cover"
                />
              ) : (
                // Video thumbnail placeholder
                <div className="flex h-full w-full items-center justify-center bg-surface text-slate/60">
                  <span className="text-xl">▶</span>
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
