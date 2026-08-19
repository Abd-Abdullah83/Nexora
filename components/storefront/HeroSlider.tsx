"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
}

interface HeroSliderProps {
  categories: Category[];
}

// Fallback slide data if categories have no images
const FALLBACK_SLIDES = [
  {
    title: "Discover Premium Products",
    tagline: "Curated essentials for modern living",
    slug: "",
    bg: "from-charcoal to-charcoal/80",
    accent: "#B08D57",
  },
];

const SLIDE_COLORS = [
  { bg: "#1A1A1A", text: "#F7F5F0" },
  { bg: "#2C2416", text: "#F7F5F0" },
  { bg: "#1A2A1A", text: "#F7F5F0" },
  { bg: "#1A1A2A", text: "#F7F5F0" },
  { bg: "#2A1A1A", text: "#F7F5F0" },
];

export function HeroSlider({ categories }: HeroSliderProps) {
  const [current, setCurrent] = useState(0);
  const [animating, setAnimating] = useState(false);

  const slides = categories.length > 0 ? categories : [];

  const goTo = useCallback((idx: number) => {
    if (animating) return;
    setAnimating(true);
    setCurrent(idx);
    setTimeout(() => setAnimating(false), 600);
  }, [animating]);

  const next = useCallback(() => {
    goTo((current + 1) % Math.max(slides.length, 1));
  }, [current, slides.length, goTo]);

  const prev = useCallback(() => {
    goTo((current - 1 + Math.max(slides.length, 1)) % Math.max(slides.length, 1));
  }, [current, slides.length, goTo]);

  // Auto-advance every 5s
  useEffect(() => {
    if (slides.length <= 1) return;
    const t = setInterval(next, 5000);
    return () => clearInterval(t);
  }, [next, slides.length]);

  if (slides.length === 0) {
    return (
      <section className="relative overflow-hidden bg-charcoal px-4 py-24 text-center">
        <div className="mx-auto max-w-2xl">
          <p className="text-xs uppercase tracking-[0.3em] text-gold mb-4">Welcome to</p>
          <h1 className="font-display text-4xl text-white sm:text-5xl mb-4">Nexora</h1>
          <p className="text-white/60 mb-8">Premium Marketplace — Curated essentials for modern living</p>
          <Link href="/products" className="inline-block rounded-sm bg-gold px-8 py-3 text-sm font-semibold text-white hover:bg-goldDark transition">
            Explore Products
          </Link>
        </div>
      </section>
    );
  }

  const slide = slides[current];
  const colors = SLIDE_COLORS[current % SLIDE_COLORS.length];

  return (
    <section
      className="relative overflow-hidden"
      style={{ backgroundColor: colors.bg }}
    >
      {/* Slide content */}
      <div
        className="relative mx-auto flex max-w-7xl items-center px-8 py-16 sm:py-24"
        style={{ minHeight: "380px" }}
      >
        {/* Text content */}
        <div
          key={current}
          className="relative z-10 max-w-xl"
          style={{
            animation: "heroFadeIn 0.6s ease-out",
          }}
        >
          <p className="mb-3 text-xs uppercase tracking-[0.3em] text-gold">
            Featured Category
          </p>
          <h1 className="font-display text-4xl font-normal leading-tight text-white sm:text-5xl mb-4">
            {slide.name}
          </h1>
          {slide.description && (
            <p className="mb-8 text-base leading-relaxed text-white/60 max-w-md">
              {slide.description}
            </p>
          )}
          <div className="flex items-center gap-4">
            <Link
              href={`/products/${slide.slug}`}
              className="inline-block rounded-sm bg-gold px-8 py-3 text-sm font-semibold text-white transition hover:bg-goldDark"
            >
              Explore {slide.name}
            </Link>
            <Link
              href="/products"
              className="text-sm text-white/50 transition hover:text-white"
            >
              Browse all →
            </Link>
          </div>
        </div>

        {/* Category image if available */}
        {slide.imageUrl && (
          <div className="absolute right-0 top-0 h-full w-1/2 overflow-hidden opacity-30 sm:opacity-50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={slide.imageUrl}
              alt={slide.name}
              className="h-full w-full object-cover"
              style={{ filter: "saturate(0.8)" }}
            />
            <div className="absolute inset-0" style={{ background: `linear-gradient(to right, ${colors.bg}, transparent)` }} />
          </div>
        )}

        {/* Decorative pattern when no image */}
        {!slide.imageUrl && (
          <div className="absolute right-8 top-1/2 -translate-y-1/2 opacity-10">
            <div className="h-48 w-48 rounded-full border border-gold" />
            <div className="absolute left-8 top-8 h-32 w-32 rounded-full border border-gold" />
          </div>
        )}
      </div>

      {/* Arrows */}
      {slides.length > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-4 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 text-white/60 transition hover:border-gold hover:text-gold"
            aria-label="Previous slide"
          >
            ‹
          </button>
          <button
            onClick={next}
            className="absolute right-4 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 text-white/60 transition hover:border-gold hover:text-gold"
            aria-label="Next slide"
          >
            ›
          </button>
        </>
      )}

      {/* Dots */}
      {slides.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`h-1.5 rounded-full transition-all ${i === current ? "w-6 bg-gold" : "w-1.5 bg-white/30"
                }`}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      )}

      <style jsx>{`
        @keyframes heroFadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </section>
  );
}
