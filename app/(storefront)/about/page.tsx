import { StaticPage, Section } from "@/components/storefront/StaticPage";

export const metadata = { title: "About Us — Nexora" };

export default function AboutPage() {
  return (
    <StaticPage
      title="About Nexora"
      subtitle="A premium marketplace built with care, secured at every step."
    >
      <div className="mb-8 rounded-sm border border-ivoryBorder bg-white p-6">
        <p className="text-sm leading-relaxed text-muted">
          Nexora is a curated online marketplace offering premium products across
          Home Decor, Clothing, Skin Care, and Electronics. We believe shopping
          online should feel trustworthy, elegant, and effortless — so we built
          a platform that prioritizes quality over quantity, security over
          shortcuts, and the customer experience above all else.
        </p>
      </div>

      <Section title="Our Mission">
        <p>
          To connect discerning customers with thoughtfully selected products,
          delivered with the reliability and care that defines a premium brand.
          Every product on Nexora is reviewed for quality before it reaches our
          catalogue.
        </p>
      </Section>

      <Section title="Why Nexora?">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              icon: "🔒",
              title: "Secure by Design",
              body: "Enterprise-grade authentication, encrypted data, and secure payments at every touchpoint.",
            },
            {
              icon: "✦",
              title: "Curated Quality",
              body: "Every product is selected for quality. We don't list everything — we list the best.",
            },
            {
              icon: "📦",
              title: "Reliable Delivery",
              body: "Clear tracking, honest timelines, and a returns process that respects your time.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-sm border border-ivoryBorder bg-ivory p-4 text-center"
            >
              <div className="mb-2 text-2xl">{item.icon}</div>
              <p className="font-semibold text-charcoal text-sm">{item.title}</p>
              <p className="mt-1 text-xs text-muted">{item.body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Contact Our Team">
        <p>
          We&apos;re a small, dedicated team passionate about building great
          products. Reach us anytime at{" "}
          <a href="mailto:support@nexora.pk" className="text-gold hover:underline">
            support@nexora.pk
          </a>{" "}
          or visit our{" "}
          <a href="/contact" className="text-gold hover:underline">
            Contact page
          </a>.
        </p>
      </Section>
    </StaticPage>
  );
}
