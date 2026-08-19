"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect, useCallback } from "react";
import { useSession } from "@/hooks/useSession";
import { CartIcon } from "@/components/cart/CartIcon";

interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  level: number;
  children: CategoryNode[];
}

function getCsrfToken(): string {
  return (
    document.cookie
      .split("; ")
      .find((c) => c.startsWith("csrf_token="))
      ?.split("=")[1] ?? ""
  );
}

export function StorefrontHeader() {
  const router = useRouter();
  const { user, isLoggedIn, isLoading, refresh } = useSession();
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const megaRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const hoverTimeout = useRef<NodeJS.Timeout>();

  // Fetch category tree (root + children) — public endpoint, no admin session required
  useEffect(() => {
    fetch("/api/categories/tree")
      .then((r) => r.json())
      .then((data) => setCategories(data.tree ?? []))
      .catch(() => { });
  }, []);

  // Close account dropdown outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) router.push(`/search?q=${encodeURIComponent(query.trim())}`);
  }

  async function handleSignOut() {
    setSigningOut(true);
    setMenuOpen(false);
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "x-csrf-token": getCsrfToken() },
      });
      await refresh();
      router.push("/");
      router.refresh();
    } catch { }
    finally { setSigningOut(false); }
  }

  function handleCatEnter(id: string) {
    clearTimeout(hoverTimeout.current);
    setActiveCategory(id);
  }

  function handleCatLeave() {
    hoverTimeout.current = setTimeout(() => setActiveCategory(null), 150);
  }

  function handleMegaEnter() {
    clearTimeout(hoverTimeout.current);
  }

  const activeNode = categories.find((c) => c.id === activeCategory);

  const initials = user?.fullName
    ? user.fullName.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase()
    : "";

  return (
    <>
      <header className="sticky top-0 z-40 bg-parchment" style={{ boxShadow: "0 1px 0 #E8E4DC, 0 2px 8px rgba(0,0,0,0.04)" }}>

        {/* ── Top utility bar ───────────────────────────────────────────── */}
        <div className="border-b border-ivoryBorder bg-ivory">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-1.5 sm:px-6">
            <p className="text-xs text-muted">
              Free delivery on orders over PKR 2,000
            </p>
            <div className="flex items-center gap-4 text-xs text-muted">
              <span>Support: <a href="mailto:support@nexora.com" className="hover:text-gold transition-colors">support@nexora.com</a></span>
              <span className="hidden sm:inline">|</span>
              <span className="hidden sm:inline">Mon–Sat 9am–6pm</span>
            </div>
          </div>
        </div>

        {/* ── Main header ───────────────────────────────────────────────── */}
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileOpen((o) => !o)}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-sm border border-ivoryBorder text-muted transition hover:border-gold hover:text-gold lg:hidden"
            aria-label="Menu"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d={mobileOpen ? "M6 18L18 6M6 6l12 12" : "M3 6h18M3 12h18M3 18h18"} />
            </svg>
          </button>

          {/* Logo — centered on desktop */}
          <div className="flex flex-1 items-center justify-start lg:justify-center">
            <Link href="/" className="flex flex-col items-center gap-0.5 group">
              <div className="flex items-center gap-2">
                {/* Logo mark */}
                <div className="flex h-8 w-8 items-center justify-center rounded-full border border-gold/50 bg-gold/10 font-display text-sm italic text-gold transition group-hover:bg-gold/20">
                  N
                </div>
                <span className="font-display text-xl tracking-[0.15em] text-charcoal uppercase">
                  Nexora
                </span>
              </div>
              <span className="text-[9px] tracking-[0.3em] text-muted uppercase">
                Premium Marketplace
              </span>
            </Link>
          </div>

          {/* Search bar */}
          <form onSubmit={handleSearch} className="hidden flex-1 max-w-lg lg:flex">
            <div className="relative w-full">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search products, brands, categories..."
                className="w-full rounded-sm border border-ivoryBorder bg-white px-4 py-2.5 pr-12 text-sm text-charcoal outline-none transition placeholder:text-subtle focus:border-gold focus:ring-1 focus:ring-gold/20"
              />
              <button
                type="submit"
                className="absolute right-0 top-0 flex h-full w-12 items-center justify-center rounded-r-sm bg-gold text-white transition hover:bg-goldDark"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
              </button>
            </div>
          </form>

          {/* Right actions */}
          <div className="flex flex-1 items-center justify-end gap-2 lg:flex-none">

            {/* Wishlist */}
            {isLoggedIn && (
              <Link href="/account/wishlist"
                className="flex h-9 w-9 items-center justify-center rounded-sm border border-ivoryBorder text-muted transition hover:border-gold hover:text-gold"
                title="Wishlist"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                </svg>
              </Link>
            )}

            {/* Account */}
            {isLoading ? (
              <div className="h-9 w-20 animate-pulse rounded-sm bg-ivoryDark" />
            ) : !isLoggedIn ? (
              <div className="flex items-center gap-2">
                <Link href="/login" className="text-sm text-muted transition hover:text-gold">Login</Link>
                <Link href="/register" className="hidden rounded-sm bg-gold px-3 py-2 text-xs font-semibold text-white transition hover:bg-goldDark sm:block">
                  Register
                </Link>
              </div>
            ) : (
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen((o) => !o)}
                  className="flex items-center gap-2 rounded-sm border border-ivoryBorder px-3 py-1.5 text-sm transition hover:border-gold"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gold/15 text-xs font-bold text-gold">
                    {initials}
                  </span>
                  <span className="hidden max-w-[80px] truncate text-sm text-charcoal sm:block">
                    {user?.fullName.split(" ")[0]}
                  </span>
                  <svg className={`h-3.5 w-3.5 text-muted transition-transform ${menuOpen ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                  </svg>
                </button>

                {menuOpen && (
                  <div className="absolute right-0 top-full z-50 mt-2 w-52 rounded-sm border border-ivoryBorder bg-white py-1 shadow-dropdown animate-fadeIn">
                    <div className="border-b border-ivoryBorder px-4 py-3">
                      <p className="truncate text-sm font-medium text-charcoal">{user?.fullName}</p>
                      <p className="truncate text-xs text-muted">{user?.email}</p>
                    </div>
                    <div className="py-1">
                      <DropLink href="/account/orders" onClick={() => setMenuOpen(false)}>My Orders</DropLink>
                      <DropLink href="/account/wishlist" onClick={() => setMenuOpen(false)}>My Wishlist</DropLink>
                      {user?.role === "customer" && (
                        <>
                          <div className="my-1 border-t border-ivoryBorder" />
                          <DropLink href="/seller/apply" onClick={() => setMenuOpen(false)}>
                            Become a Seller
                          </DropLink>
                        </>
                      )}
                      {(user?.role === "seller_individual" || user?.role === "seller_business") && (
                        <>
                          <div className="my-1 border-t border-ivoryBorder" />
                          <DropLink href="/seller/dashboard" onClick={() => setMenuOpen(false)}>
                            Seller Central
                          </DropLink>
                        </>
                      )}
                      {user?.role === "admin" && (
                        <>
                          <div className="my-1 border-t border-ivoryBorder" />
                          <DropLink href="/admin/dashboard" onClick={() => setMenuOpen(false)}>Admin Panel</DropLink>
                        </>
                      )}
                      <div className="my-1 border-t border-ivoryBorder" />
                      <button
                        onClick={handleSignOut}
                        disabled={signingOut}
                        className="flex w-full items-center px-4 py-2 text-sm text-red-500 transition hover:bg-ivoryDark disabled:opacity-50"
                      >
                        {signingOut ? "Signing out…" : "Sign Out"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Cart */}
            <div className="[&_button]:border [&_button]:border-ivoryBorder [&_button]:rounded-sm [&_button]:transition [&_button:hover]:border-gold">
              <CartIcon />
            </div>
          </div>
        </div>

        {/* ── Category nav with mega menu ───────────────────────────────── */}
        <div className="hidden border-t border-ivoryBorder lg:block">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <nav className="flex items-center gap-0" aria-label="Categories">
              {/* All categories link */}
              <Link
                href="/"
                className="flex items-center gap-1.5 border-r border-ivoryBorder px-4 py-3 text-sm font-medium text-charcoal transition hover:bg-ivoryDark hover:text-gold"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                </svg>
                All
              </Link>

              {categories.filter((c) => c.level === 0).map((cat) => (
                <div
                  key={cat.id}
                  className="relative"
                  onMouseEnter={() => handleCatEnter(cat.id)}
                  onMouseLeave={handleCatLeave}
                >
                  <Link
                    href={`/products/${cat.slug}`}
                    className={`flex items-center gap-1 px-4 py-3 text-sm transition hover:bg-ivoryDark hover:text-gold ${activeCategory === cat.id ? "bg-ivoryDark text-gold" : "text-charcoal"
                      }`}
                  >
                    {cat.name}
                    {cat.children.length > 0 && (
                      <svg className="h-3 w-3 text-muted" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                      </svg>
                    )}
                  </Link>
                </div>
              ))}
            </nav>
          </div>
        </div>

        {/* ── Mega menu dropdown ────────────────────────────────────────── */}
        {activeCategory && activeNode && activeNode.children.length > 0 && (
          <div
            ref={megaRef}
            onMouseEnter={handleMegaEnter}
            onMouseLeave={handleCatLeave}
            className="absolute left-0 right-0 z-50 border-t border-ivoryBorder bg-white shadow-dropdown mega-menu"
          >
            <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
              <div className="flex gap-8">
                {/* Category title */}
                <div className="w-48 flex-shrink-0 border-r border-ivoryBorder pr-8">
                  <Link
                    href={`/products/${activeNode.slug}`}
                    onClick={() => setActiveCategory(null)}
                    className="font-display text-base font-medium text-charcoal hover:text-gold transition"
                  >
                    {activeNode.name}
                  </Link>
                  <p className="mt-1 text-xs text-muted">Browse all</p>
                  <Link
                    href={`/products/${activeNode.slug}`}
                    onClick={() => setActiveCategory(null)}
                    className="mt-3 inline-flex items-center gap-1 text-xs text-gold hover:text-goldDark transition"
                  >
                    View all →
                  </Link>
                </div>

                {/* Subcategories grid */}
                <div className="flex-1">
                  <div className="grid grid-cols-2 gap-x-8 gap-y-1 sm:grid-cols-3 lg:grid-cols-4">
                    {activeNode.children.map((child) => (
                      <div key={child.id}>
                        <Link
                          href={`/products/${child.slug}`}
                          onClick={() => setActiveCategory(null)}
                          className="block py-1.5 text-sm text-charcoal transition hover:text-gold"
                        >
                          {child.name}
                        </Link>
                        {/* Grandchildren */}
                        {child.children?.map((grand) => (
                          <Link
                            key={grand.id}
                            href={`/products/${grand.slug}`}
                            onClick={() => setActiveCategory(null)}
                            className="block py-1 pl-3 text-xs text-muted transition hover:text-gold"
                          >
                            {grand.name}
                          </Link>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Mobile search ─────────────────────────────────────────────── */}
        <div className="border-t border-ivoryBorder px-4 py-2 lg:hidden">
          <form onSubmit={handleSearch} className="relative">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products..."
              className="w-full rounded-sm border border-ivoryBorder bg-white px-4 py-2 pr-10 text-sm text-charcoal outline-none placeholder:text-subtle focus:border-gold"
            />
            <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-gold">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </button>
          </form>
        </div>
      </header>

      {/* ── Mobile nav drawer ─────────────────────────────────────────────── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-charcoal/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-72 overflow-y-auto bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-ivoryBorder px-4 py-4">
              <span className="font-display text-lg text-charcoal">Categories</span>
              <button onClick={() => setMobileOpen(false)} className="text-muted hover:text-charcoal">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <nav className="py-2">
              {categories.filter((c) => c.level === 0).map((cat) => (
                <div key={cat.id}>
                  <Link
                    href={`/products/${cat.slug}`}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center justify-between px-4 py-3 text-sm font-medium text-charcoal hover:bg-ivoryDark hover:text-gold transition"
                  >
                    {cat.name}
                  </Link>
                  {cat.children.map((child) => (
                    <Link
                      key={child.id}
                      href={`/products/${child.slug}`}
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center px-8 py-2 text-sm text-muted hover:text-gold transition"
                    >
                      {child.name}
                    </Link>
                  ))}
                </div>
              ))}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}

function DropLink({ href, children, onClick }: { href: string; children: React.ReactNode; onClick: () => void }) {
  return (
    <Link href={href} onClick={onClick} className="flex items-center px-4 py-2 text-sm text-muted transition hover:bg-ivoryDark hover:text-charcoal">
      {children}
    </Link>
  );
}