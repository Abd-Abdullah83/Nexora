// components/seller/ui.tsx
//
// Small shared primitives so the "animated field highlighting" the user
// asked for is defined ONCE and applied consistently across every Seller
// Central page, rather than each form re-implementing its own focus-ring
// CSS slightly differently. Pure styling wrappers — no new state, no new
// data fetching, safe to drop into any existing form without touching
// that form's logic.

import { forwardRef } from "react";

/**
 * Animated text/textarea/select field wrapper. Wrap any native <input>,
 * <textarea>, or <select> and it gets: a smooth border-color + ring
 * transition on focus, an error state, and a label.
 *
 * Usage:
 *   <Field label="Product name" error={errors.name}>
 *     <input className={fieldInputClass} value={...} onChange={...} />
 *   </Field>
 */
export function Field({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-charcoal">
        {label}
        {required && <span className="text-gold"> *</span>}
      </span>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-subtle">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </label>
  );
}

// The actual animated classes — exported as a string so existing native
// <input>/<textarea>/<select> elements can adopt them with one className
// change, without needing to be rewritten as a new component.
export const fieldInputClass =
  "w-full rounded-md border border-ivoryBorder bg-white px-3 py-2 text-sm text-charcoal placeholder:text-subtle " +
  "transition-all duration-150 ease-out " +
  "focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/15 " +
  "hover:border-goldDark/30";

export const fieldInputErrorClass =
  "w-full rounded-md border border-red-300 bg-red-50/30 px-3 py-2 text-sm text-charcoal placeholder:text-subtle " +
  "transition-all duration-150 ease-out " +
  "focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-200";

export function fieldClass(hasError?: boolean) {
  return hasError ? fieldInputErrorClass : fieldInputClass;
}

/**
 * Card — the standard white panel used across every Seller Central page.
 * Optional hover lift for cards that are themselves clickable/interactive.
 */
export function Card({
  children,
  className = "",
  hoverable = false,
}: {
  children: React.ReactNode;
  className?: string;
  hoverable?: boolean;
}) {
  return (
    <div
      className={`rounded-md border border-ivoryBorder bg-white p-5 transition-all duration-150 ${
        hoverable ? "hover:-translate-y-0.5 hover:border-gold/20 hover:shadow-card" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * Status badge — consistent pill styling for order/listing/subscription
 * statuses across all Seller Central pages. `tone` maps to the design
 * system's success/warning/error/neutral/gold palette.
 */
export function StatusBadge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "success" | "warning" | "error" | "neutral" | "gold";
}) {
  const toneClasses = {
    success: "bg-emerald-50 text-emerald-700",
    warning: "bg-amber-50 text-amber-700",
    error: "bg-red-50 text-red-700",
    neutral: "bg-ivoryDark text-muted",
    gold: "bg-gold/10 text-gold",
  }[tone];

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${toneClasses}`}>
      {children}
    </span>
  );
}

/**
 * Primary button — gold fill, used for the main action on a page/form.
 */
export const PrimaryButton = forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  function PrimaryButton({ className = "", children, ...props }, ref) {
    return (
      <button
        ref={ref}
        className={`inline-flex items-center justify-center gap-2 rounded-md bg-gold px-5 py-2 text-sm font-semibold text-white transition-all duration-150 hover:bg-goldDark hover:shadow-card disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);

/**
 * Secondary button — outline style, used for cancel/alternate actions.
 */
export const SecondaryButton = forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  function SecondaryButton({ className = "", children, ...props }, ref) {
    return (
      <button
        ref={ref}
        className={`inline-flex items-center justify-center gap-2 rounded-md border border-ivoryBorder bg-white px-5 py-2 text-sm font-medium text-charcoal transition-all duration-150 hover:border-gold/30 hover:text-gold disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);
