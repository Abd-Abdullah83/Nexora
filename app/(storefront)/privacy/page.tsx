import { StaticPage, Section } from "@/components/storefront/StaticPage";

export const metadata = { title: "Privacy Policy — Nexora" };

const LAST_UPDATED = "June 2026";

export default function PrivacyPage() {
  return (
    <StaticPage
      title="Privacy Policy"
      subtitle={`Last updated: ${LAST_UPDATED}`}
    >
      <div className="mb-6 rounded-sm border border-gold/20 bg-gold/5 px-4 py-3 text-sm text-charcoal">
        Your privacy is important to us. This policy explains what data we collect, how we use it, and your rights.
      </div>

      <Section title="1. Information We Collect">
        <p><strong className="text-charcoal">Account information:</strong> Name, email address, username, and hashed password when you register.</p>
        <p><strong className="text-charcoal">Order information:</strong> Shipping address, order contents, and payment status. We do not store card numbers — payments are processed by a third-party provider.</p>
        <p><strong className="text-charcoal">Usage data:</strong> IP address, browser type, and pages visited, used solely to improve the platform and detect abuse.</p>
        <p><strong className="text-charcoal">Communications:</strong> If you contact us, we retain that correspondence to resolve your query.</p>
      </Section>

      <Section title="2. How We Use Your Information">
        <ul className="list-disc pl-5 space-y-1">
          <li>To process and fulfil your orders</li>
          <li>To send order confirmation and status emails</li>
          <li>To provide customer support</li>
          <li>To improve the platform and prevent fraud</li>
          <li>To comply with legal obligations</li>
        </ul>
        <p>We do not sell your personal data to third parties. Ever.</p>
      </Section>

      <Section title="3. Data Security">
        <p>All passwords are hashed using bcrypt with a cost factor of 12. Sessions are stored server-side in Redis. All connections use HTTPS. Admin accounts require two-factor authentication.</p>
      </Section>

      <Section title="4. Cookies">
        <p>We use a session cookie (HttpOnly, Secure, SameSite=Strict) for authentication and a CSRF token cookie for security. We do not use advertising cookies or third-party tracking.</p>
      </Section>

      <Section title="5. Data Retention">
        <p>Account data is retained while your account is active. Order records are retained for 7 years for tax and legal purposes. You may request deletion of your account at any time by contacting us.</p>
      </Section>

      <Section title="6. Your Rights">
        <ul className="list-disc pl-5 space-y-1">
          <li>Right to access your personal data</li>
          <li>Right to correct inaccurate data</li>
          <li>Right to request deletion of your account</li>
          <li>Right to data portability</li>
        </ul>
        <p>To exercise any of these rights, email <a href="mailto:privacy@nexora.pk" className="text-gold hover:underline">privacy@nexora.pk</a>.</p>
      </Section>

      <Section title="7. Contact">
        <p>Questions about this policy? Contact us at <a href="mailto:privacy@nexora.pk" className="text-gold hover:underline">privacy@nexora.pk</a> or visit our <a href="/contact" className="text-gold hover:underline">Contact page</a>.</p>
      </Section>
    </StaticPage>
  );
}
