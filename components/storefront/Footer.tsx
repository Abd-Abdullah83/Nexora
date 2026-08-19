import Link from "next/link";

interface FooterCategory {
  id: string;
  name: string;
  slug: string;
}

interface FooterProps {
  categories?: FooterCategory[];
}

// ── Admin contact info — edit these two entries directly, nothing else
// in this file needs to change when they do. ──────────────────────────────
const ADMINS = [
  {
    name: "Abdullah",
    email: "abdullah.a.t.383@gmail.com",
    phone: "+92 328 6712746",
  },
  {
    name: "Fahad Saleem",
    email: "fahadsaleem000007@gmail.com",
    phone: "+92 319 4192731",
  },
];

// ── Placeholder testimonials — swap in real customer reviews once the
// review-aggregation feed is wired up here. ────────────────────────────────
const TESTIMONIALS = [
  {
    quote: "Packaging was beautiful and the product arrived exactly as described. Will definitely order again.",
    name: "Sana K.",
    rating: 5,
  },
  {
    quote: "Fast delivery and the customer support team was genuinely helpful when I had a sizing question.",
    name: "Bilal R.",
    rating: 5,
  },
  {
    quote: "Quality feels premium for the price. The skincare set is now part of my daily routine.",
    name: "Areeba T.",
    rating: 4,
  },
];

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`h-3.5 w-3.5 ${star <= rating ? "text-gold" : "text-ivoryBorder"}`}
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.176 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118l-2.8-2.034c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

export function Footer({ categories = [] }: FooterProps) {
  return (
    <footer className="border-t border-ivoryBorder bg-white">
      {/* ── Reviews & testimonials ──────────────────────────────────────── */}
      <div className="border-b border-ivoryBorder bg-ivory">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
          <div className="mb-8 text-center">
            <p className="text-xs uppercase tracking-[0.3em] text-gold mb-2">What customers say</p>
            <h2 className="font-display text-2xl text-charcoal">Loved by shoppers across Pakistan</h2>
            <div className="mt-3 flex items-center justify-center gap-2">
              <StarRow rating={5} />
              <span className="text-sm text-muted">4.8 / 5 average rating</span>
            </div>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="rounded-lg border border-ivoryBorder bg-white p-5">
                <StarRow rating={t.rating} />
                <p className="mt-3 text-sm leading-relaxed text-charcoal/80">&ldquo;{t.quote}&rdquo;</p>
                <p className="mt-3 text-xs font-medium text-muted">— {t.name}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Link columns ─────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          {/* Brand */}
          <div className="col-span-2 sm:col-span-1">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-gold/50 bg-gold/10 font-display text-sm italic text-gold">
                N
              </div>
              <span className="font-display text-lg tracking-[0.15em] text-charcoal uppercase">
                Nexora
              </span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Premium essentials, curated for modern living.
            </p>
          </div>

          {/* Company */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-charcoal">Company</h3>
            <ul className="mt-4 space-y-2.5 text-sm text-muted">
              <li><Link href="/about" className="hover:text-gold transition">About Us</Link></li>
              <li><Link href="/terms" className="hover:text-gold transition">Terms &amp; Conditions</Link></li>
              <li><Link href="/privacy" className="hover:text-gold transition">Privacy Policy</Link></li>
            </ul>
          </div>

          {/* Categories */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-charcoal">Categories</h3>
            <ul className="mt-4 space-y-2.5 text-sm text-muted">
              {categories.length > 0 ? (
                categories.slice(0, 6).map((c) => (
                  <li key={c.id}>
                    <Link href={`/products/${c.slug}`} className="hover:text-gold transition">
                      {c.name}
                    </Link>
                  </li>
                ))
              ) : (
                <li className="text-subtle">No categories yet</li>
              )}
            </ul>
          </div>

          {/* Customer support */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-charcoal">Customer Support</h3>
            <ul className="mt-4 space-y-2.5 text-sm text-muted">
              <li><Link href="/faq" className="hover:text-gold transition">FAQ</Link></li>
              <li><Link href="/returns" className="hover:text-gold transition">Returns</Link></li>
              <li><Link href="/contact" className="hover:text-gold transition">Contact Support</Link></li>
            </ul>
          </div>
        </div>

        {/* ── Admin contact ──────────────────────────────────────────────── */}
        <div className="mt-10 grid gap-4 rounded-lg border border-ivoryBorder bg-ivory p-5 sm:grid-cols-2">
          {ADMINS.map((admin, i) => (
            <div key={admin.email} className={i === 0 ? "sm:border-r sm:border-ivoryBorder sm:pr-4" : "sm:pl-4"}>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                Admin Contact {i + 1}
              </p>
              <p className="mt-1.5 text-sm font-medium text-charcoal">{admin.name}</p>
              <p className="text-sm text-muted">
                <a href={`mailto:${admin.email}`} className="hover:text-gold transition">{admin.email}</a>
              </p>
              <p className="text-sm text-muted">
                <a href={`tel:${admin.phone.replace(/\s+/g, "")}`} className="hover:text-gold transition">{admin.phone}</a>
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Bottom bar ───────────────────────────────────────────────────── */}
      <div className="border-t border-ivoryBorder">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-muted sm:flex-row sm:px-6">
          <p>© {new Date().getFullYear()} Nexora. All rights reserved.</p>
          <p>Premium Marketplace · Pakistan</p>
        </div>
      </div>
    </footer>
  );
}