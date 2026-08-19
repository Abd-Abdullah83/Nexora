"use client";

import { useState } from "react";
import { StaticPage } from "@/components/storefront/StaticPage";

const FAQS = [
  {
    category: "Orders",
    items: [
      {
        q: "How do I track my order?",
        a: "Once your order ships, you'll receive a tracking number via email. You can also view your order status by logging into your account and visiting My Orders.",
      },
      {
        q: "Can I change or cancel my order after placing it?",
        a: "Orders can be changed or cancelled within 1 hour of placement, before they enter processing. Contact us immediately at support@nexora.pk with your order number.",
      },
      {
        q: "How long does delivery take?",
        a: "Standard delivery takes 3–5 business days within major cities, and 5–7 business days for other areas. Express options may be available at checkout.",
      },
    ],
  },
  {
    category: "Payments",
    items: [
      {
        q: "What payment methods do you accept?",
        a: "We currently accept Cash on Delivery (COD) for all orders. JazzCash, EasyPaisa, and card payments are coming soon.",
      },
      {
        q: "Is Cash on Delivery available everywhere?",
        a: "COD is available across Pakistan. The option will appear automatically at checkout based on your delivery address.",
      },
      {
        q: "When is my payment charged for COD?",
        a: "For COD orders, payment is collected by the delivery rider at the time of delivery. No amount is charged in advance.",
      },
    ],
  },
  {
    category: "Returns & Refunds",
    items: [
      {
        q: "What is your return policy?",
        a: "We accept returns within 7 days of delivery for unused items in original packaging. Visit our Returns page to submit a return request.",
      },
      {
        q: "How long does a refund take?",
        a: "Once we receive and inspect returned items, refunds are processed within 3–5 business days.",
      },
      {
        q: "What items cannot be returned?",
        a: "Opened Skin Care products, customised items, and items damaged through misuse cannot be returned. See our Returns Policy for the full list.",
      },
    ],
  },
  {
    category: "Account",
    items: [
      {
        q: "How do I create an account?",
        a: "Click Register in the top navigation. You'll need a valid email address and a unique username. Email verification is required before your first login.",
      },
      {
        q: "I forgot my password. What do I do?",
        a: "Click 'Forgot password?' on the login page. We'll send a reset link to your registered email address. The link expires after 1 hour.",
      },
      {
        q: "Can I login with my username instead of email?",
        a: "Yes — both your email address and username are accepted on the login page.",
      },
    ],
  },
];

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-ivoryBorder last:border-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-4 py-4 text-left"
      >
        <span className="text-sm font-medium text-charcoal">{question}</span>
        <span className={`flex-shrink-0 text-gold transition-transform ${open ? "rotate-45" : ""}`}>
          +
        </span>
      </button>
      {open && (
        <p className="pb-4 text-sm leading-relaxed text-muted">{answer}</p>
      )}
    </div>
  );
}

export default function FAQPage() {
  return (
    <StaticPage title="Frequently Asked Questions" subtitle="Find answers to the most common questions about Nexora.">
      <div className="flex flex-col gap-6">
        {FAQS.map((section) => (
          <div key={section.category} className="rounded-sm border border-ivoryBorder bg-white p-6">
            <h2 className="mb-3 font-display text-lg text-charcoal">{section.category}</h2>
            {section.items.map((item) => (
              <FAQItem key={item.q} question={item.q} answer={item.a} />
            ))}
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-sm border border-ivoryBorder bg-white p-6 text-center">
        <p className="font-display text-base text-charcoal">Still have questions?</p>
        <p className="mt-1 text-sm text-muted">Our support team is happy to help.</p>
        <a
          href="/contact"
          className="mt-4 inline-block rounded-sm bg-gold px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-goldDark"
        >
          Contact Support
        </a>
      </div>
    </StaticPage>
  );
}
