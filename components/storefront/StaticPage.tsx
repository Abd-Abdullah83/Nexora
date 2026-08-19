import Link from "next/link";
import { StorefrontHeader } from "@/components/storefront/StorefrontHeader";
import { Footer } from "@/components/storefront/Footer";

interface StaticPageProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export function StaticPage({ title, subtitle, children }: StaticPageProps) {
  return (
    <div className="min-h-screen bg-ivory">
      <StorefrontHeader />

      {/* Page hero */}
      <div className="border-b border-ivoryBorder bg-white">
        <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
          <nav className="mb-3 text-xs text-muted">
            <Link href="/" className="hover:text-gold transition">Home</Link>
            <span className="mx-2 text-ivoryBorder">/</span>
            <span className="text-charcoal">{title}</span>
          </nav>
          <h1 className="font-display text-3xl text-charcoal">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-muted">{subtitle}</p>}
        </div>
      </div>

      {/* Content */}
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        {children}
      </main>

      <Footer />
    </div>
  );
}

// Reusable prose section
export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 font-display text-xl text-charcoal">{title}</h2>
      <div className="text-sm leading-relaxed text-muted space-y-3">{children}</div>
    </section>
  );
}
