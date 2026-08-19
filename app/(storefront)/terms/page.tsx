import { StaticPage, Section } from "@/components/storefront/StaticPage";

export const metadata = { title: "Terms & Conditions — Nexora" };

export default function TermsPage() {
  return (
    <StaticPage title="Terms & Conditions" subtitle="Last updated: June 2026">
      <Section title="1. Acceptance of Terms">
        <p>By accessing or using Nexora, you agree to be bound by these Terms and Conditions. If you do not agree, please do not use our platform.</p>
      </Section>

      <Section title="2. Use of the Platform">
        <ul className="list-disc pl-5 space-y-1">
          <li>You must be at least 16 years old to create an account.</li>
          <li>You are responsible for keeping your account credentials secure.</li>
          <li>You may not use the platform for any unlawful purpose.</li>
          <li>You may not attempt to circumvent security measures.</li>
        </ul>
      </Section>

      <Section title="3. Orders and Payments">
        <p>All prices are displayed in the listed currency (PKR by default) and are inclusive of applicable taxes unless stated otherwise. We reserve the right to cancel any order if a pricing error is detected, with a full refund issued.</p>
        <p>Cash on Delivery (COD) orders are confirmed upon placement. Payment is collected at the time of delivery. For other payment methods, stock is reserved only upon successful payment confirmation.</p>
      </Section>

      <Section title="4. Shipping">
        <p>Delivery timelines are estimates only. Nexora is not liable for delays caused by courier services, customs, or circumstances beyond our control. Risk of loss passes to you upon delivery.</p>
      </Section>

      <Section title="5. Returns and Refunds">
        <p>Returns are accepted within 7 days of delivery for eligible items in their original, unused condition. See our <a href="/returns" className="text-gold hover:underline">Returns Policy</a> for full details.</p>
      </Section>

      <Section title="6. Intellectual Property">
        <p>All content on Nexora — including text, images, logos, and software — is the property of Nexora or its licensors. You may not reproduce, distribute, or create derivative works without explicit written permission.</p>
      </Section>

      <Section title="7. Limitation of Liability">
        <p>To the maximum extent permitted by law, Nexora shall not be liable for any indirect, incidental, or consequential damages arising from your use of the platform.</p>
      </Section>

      <Section title="8. Changes to Terms">
        <p>We may update these terms from time to time. Continued use of Nexora after changes constitutes acceptance of the new terms. Significant changes will be notified via email.</p>
      </Section>

      <Section title="9. Contact">
        <p>For questions about these terms, contact us at <a href="mailto:legal@nexora.pk" className="text-gold hover:underline">legal@nexora.pk</a>.</p>
      </Section>
    </StaticPage>
  );
}
