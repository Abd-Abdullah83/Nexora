"use client";

import { useState } from "react";
import { StaticPage } from "@/components/storefront/StaticPage";

// ── Admin contact info — update here when team changes ──────────────────
const ADMIN_CONTACTS = [
  {
    name: "Abdullah",
    role: "Founder & Operations",
    email: "abdullah@nexora.pk",
    phone: "+92 300 0000001",
  },
  {
    name: "Support Team",
    role: "Customer Support",
    email: "support@nexora.pk",
    phone: "+92 300 0000002",
  },
];

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    // Placeholder — wire to your email API when ready
    await new Promise((r) => setTimeout(r, 1000));
    setStatus("sent");
  }

  return (
    <StaticPage title="Contact Us" subtitle="We typically respond within 24 hours.">
      <div className="grid gap-8 md:grid-cols-2">

        {/* Contact form */}
        <div className="rounded-sm border border-ivoryBorder bg-white p-6">
          <h2 className="mb-4 font-display text-lg text-charcoal">Send a Message</h2>

          {status === "sent" ? (
            <div className="rounded-sm border border-green-200 bg-green-50 p-5 text-center">
              <p className="text-2xl mb-2">✓</p>
              <p className="font-semibold text-green-800">Message received!</p>
              <p className="mt-1 text-sm text-green-700">We&apos;ll get back to you within 24 hours.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted">Name</label>
                  <input
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    required
                    className="w-full rounded-sm border border-ivoryBorder bg-ivory px-3 py-2 text-sm text-charcoal outline-none focus:border-gold"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    required
                    className="w-full rounded-sm border border-ivoryBorder bg-ivory px-3 py-2 text-sm text-charcoal outline-none focus:border-gold"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted">Subject</label>
                <select
                  name="subject"
                  value={form.subject}
                  onChange={handleChange}
                  required
                  className="w-full rounded-sm border border-ivoryBorder bg-ivory px-3 py-2 text-sm text-charcoal outline-none focus:border-gold"
                >
                  <option value="">Select a topic</option>
                  <option value="order">Order Issue</option>
                  <option value="return">Return / Refund</option>
                  <option value="product">Product Question</option>
                  <option value="payment">Payment Problem</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted">Message</label>
                <textarea
                  name="message"
                  value={form.message}
                  onChange={handleChange}
                  required
                  rows={5}
                  className="w-full rounded-sm border border-ivoryBorder bg-ivory px-3 py-2 text-sm text-charcoal outline-none focus:border-gold resize-none"
                />
              </div>
              <button
                type="submit"
                disabled={status === "sending"}
                className="rounded-sm bg-charcoal py-3 text-sm font-semibold text-white transition hover:bg-gold disabled:opacity-60"
              >
                {status === "sending" ? "Sending…" : "Send Message"}
              </button>
            </form>
          )}
        </div>

        {/* Contact cards */}
        <div className="flex flex-col gap-4">
          {ADMIN_CONTACTS.map((contact) => (
            <div key={contact.email} className="rounded-sm border border-ivoryBorder bg-white p-5">
              <p className="font-semibold text-charcoal">{contact.name}</p>
              <p className="text-xs text-gold mb-3">{contact.role}</p>
              <div className="flex flex-col gap-1.5 text-sm text-muted">
                <a href={`mailto:${contact.email}`} className="flex items-center gap-2 hover:text-gold transition">
                  <span>✉</span> {contact.email}
                </a>
                <a href={`tel:${contact.phone}`} className="flex items-center gap-2 hover:text-gold transition">
                  <span>📞</span> {contact.phone}
                </a>
              </div>
            </div>
          ))}

          <div className="rounded-sm border border-ivoryBorder bg-white p-5">
            <p className="font-semibold text-charcoal mb-2">Business Hours</p>
            <div className="text-sm text-muted space-y-1">
              <p>Monday – Friday: 9 AM – 6 PM (PKT)</p>
              <p>Saturday: 10 AM – 4 PM (PKT)</p>
              <p>Sunday: Closed</p>
            </div>
          </div>
        </div>
      </div>
    </StaticPage>
  );
}
