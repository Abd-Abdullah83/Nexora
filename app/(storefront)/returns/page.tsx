"use client";

import { useState } from "react";
import { StaticPage, Section } from "@/components/storefront/StaticPage";

export default function ReturnsPage() {
  const [form, setForm] = useState({ orderNumber: "", email: "", reason: "", details: "" });
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    // When wired: POST to /api/returns with orderNumber + reason.
    // The admin then processes via POST /api/admin/orders/[id]/process-return
    // which refunds the order AND restocks inventory.
    await new Promise((r) => setTimeout(r, 1000));
    setStatus("sent");
  }

  const STEPS = [
    { step: "1", title: "Submit Request", body: "Fill in the form below with your order number and return reason." },
    { step: "2", title: "Admin Review", body: "We review your request within 1–2 business days and approve eligible returns." },
    { step: "3", title: "Ship Items Back", body: "Once approved, ship the item(s) to our return address. Include your order number." },
    { step: "4", title: "Refund Issued", body: "After we receive and inspect the items, your refund is processed within 3–5 business days." },
  ];

  return (
    <StaticPage
      title="Returns & Refunds"
      subtitle="We want you to love every purchase. If something isn't right, we'll make it right."
    >
      {/* Policy summary */}
      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        {[
          { icon: "📅", title: "7-Day Window", body: "Return any item within 7 days of delivery." },
          { icon: "📦", title: "Original Condition", body: "Items must be unused, unwashed, and in original packaging." },
          { icon: "💳", title: "Full Refund", body: "Approved returns receive a full refund to original payment method." },
        ].map((item) => (
          <div key={item.title} className="rounded-sm border border-ivoryBorder bg-white p-4 text-center">
            <div className="mb-2 text-2xl">{item.icon}</div>
            <p className="text-sm font-semibold text-charcoal">{item.title}</p>
            <p className="mt-1 text-xs text-muted">{item.body}</p>
          </div>
        ))}
      </div>

      <Section title="How Returns Work">
        <div className="grid gap-4 sm:grid-cols-2">
          {STEPS.map((s) => (
            <div key={s.step} className="flex gap-3 rounded-sm border border-ivoryBorder bg-white p-4">
              <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gold text-xs font-bold text-white">
                {s.step}
              </span>
              <div>
                <p className="text-sm font-semibold text-charcoal">{s.title}</p>
                <p className="mt-0.5 text-xs text-muted">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Non-Returnable Items">
        <ul className="list-disc pl-5 space-y-1 text-sm text-muted">
          <li>Opened Skin Care products (for hygiene reasons)</li>
          <li>Customised or personalised items</li>
          <li>Items damaged due to misuse</li>
          <li>Items returned after the 7-day window</li>
        </ul>
      </Section>

      {/* Return request form */}
      <div className="mt-8 rounded-sm border border-ivoryBorder bg-white p-6">
        <h2 className="mb-4 font-display text-lg text-charcoal">Submit a Return Request</h2>

        {status === "sent" ? (
          <div className="rounded-sm border border-green-200 bg-green-50 p-6 text-center">
            <p className="text-2xl mb-2">✓</p>
            <p className="font-semibold text-green-800">Return request received!</p>
            <p className="mt-1 text-sm text-green-700">
              We&apos;ll review your request and email you within 1–2 business days.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted">
                  Order Number <span className="text-red-500">*</span>
                </label>
                <input
                  name="orderNumber"
                  value={form.orderNumber}
                  onChange={handleChange}
                  required
                  placeholder="ORD-20240601-ABC123"
                  className="w-full rounded-sm border border-ivoryBorder bg-ivory px-3 py-2 text-sm font-mono text-charcoal outline-none focus:border-gold"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted">
                  Email Address <span className="text-red-500">*</span>
                </label>
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
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted">
                Reason for Return <span className="text-red-500">*</span>
              </label>
              <select
                name="reason"
                value={form.reason}
                onChange={handleChange}
                required
                className="w-full rounded-sm border border-ivoryBorder bg-ivory px-3 py-2 text-sm text-charcoal outline-none focus:border-gold"
              >
                <option value="">Select a reason</option>
                <option value="damaged">Item arrived damaged</option>
                <option value="wrong_item">Wrong item received</option>
                <option value="not_as_described">Not as described</option>
                <option value="changed_mind">Changed my mind</option>
                <option value="quality">Quality issue</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted">
                Additional Details
              </label>
              <textarea
                name="details"
                value={form.details}
                onChange={handleChange}
                rows={4}
                placeholder="Please describe the issue in detail…"
                className="w-full rounded-sm border border-ivoryBorder bg-ivory px-3 py-2 text-sm text-charcoal outline-none focus:border-gold resize-none"
              />
            </div>
            <button
              type="submit"
              disabled={status === "sending"}
              className="rounded-sm bg-charcoal py-3 text-sm font-semibold text-white transition hover:bg-gold disabled:opacity-60"
            >
              {status === "sending" ? "Submitting…" : "Submit Return Request"}
            </button>
          </form>
        )}
      </div>
    </StaticPage>
  );
}
