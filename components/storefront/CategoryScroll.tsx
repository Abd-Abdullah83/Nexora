"use client";

import Link from "next/link";
import { useRef, useState, useEffect, useCallback } from "react";

interface Category {
  id: string;
  name: string;
  slug: string;
  imageUrl?: string | null;
  description?: string | null;
}

interface CategoryScrollProps {
  categories: Category[];
}

export function CategoryScroll({ categories }: CategoryScrollProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateArrows = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    updateArrows();
    const el = scrollerRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateArrows, { passive: true });
    window.addEventListener("resize", updateArrows);
    return () => {
      el.removeEventListener("scroll", updateArrows);
      window.removeEventListener("resize", updateArrows);
    };
  }, [updateArrows, categories.length]);

  function scrollBy(dir: 1 | -1) {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.min(el.clientWidth * 0.8, 480), behavior: "smooth" });
  }

  if (categories.length === 0) {
    return (
      <p className="rounded-lg border border-ivoryBorder bg-white px-6 py-10 text-center text-sm text-muted">
        Categories will appear here once they're added.
      </p>
    );
  }

  return (
    <div className="relative">
      {/* Left arrow */}
      {canScrollLeft && (
        <button
          onClick={() => scrollBy(-1)}
          aria-label="Scroll categories left"
          className="absolute -left-3 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-ivoryBorder bg-white text-charcoal shadow-card transition hover:border-gold hover:text-gold sm:flex"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
      )}

      {/* Scroll track */}
      <div
        ref={scrollerRef}
        className="hide-scrollbar flex gap-4 overflow-x-auto scroll-smooth pb-1"
      >
        {categories.map((cat) => (
          <Link
            key={cat.id}
            href={`/products/${cat.slug}`}
            className="group block shrink-0 snap-start"
            style={{ width: "220px", flexShrink: 0 }}
          >
            <div className="relative h-48 w-full overflow-hidden rounded-lg border border-ivoryBorder bg-ivoryDark">
              {cat.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={cat.imageUrl}
                  alt={cat.name}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <span className="font-display text-3xl text-gold/40">{cat.name[0]}</span>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-charcoal/50 via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-3">
                <p className="font-display text-base text-white">{cat.name}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Right arrow */}
      {canScrollRight && (
        <button
          onClick={() => scrollBy(1)}
          aria-label="Scroll categories right"
          className="absolute -right-3 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-ivoryBorder bg-white text-charcoal shadow-card transition hover:border-gold hover:text-gold sm:flex"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      )}
    </div>
  );
}
