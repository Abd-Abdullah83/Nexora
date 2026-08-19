"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { pathForSellerStatus } from "@/lib/sellers/status-routing";

function getCsrfToken(): string {
  return (
    document.cookie
      .split("; ")
      .find((c) => c.startsWith("csrf_token="))
      ?.split("=")[1] ?? ""
  );
}

interface FormState {
  sellerType: "individual" | "business" | "";
  displayName: string;
  businessEmail: string;
  businessPhone: string;
  agreeToTerms: boolean;
}

const initialForm: FormState = {
  sellerType: "",
  displayName: "",
  businessEmail: "",
  businessPhone: "",
  agreeToTerms: false,
};

export default function SellerApplyForm() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  // Starts true: don't show the apply form for an instant before we've
  // confirmed there ISN'T already an application. Set false only once
  // the check below completes and finds no existing seller record.
  const [checkingExisting, setCheckingExisting] = useState(true);

  // If this user already has a seller application (any status), they
  // shouldn't see the apply form again — applySeller() would 422 anyway
  // ("You already have a seller application"). Redirect them straight to
  // whichever step they're actually on, instead of letting them hit that
  // error by submitting.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/sellers/status")
      .then(async (res) => {
        if (!res.ok) return; // 401 etc. — let the page render normally, auth is handled elsewhere
        const json = await res.json();
        if (!cancelled && json?.seller?.status) {
          router.replace(pathForSellerStatus(json.seller.status));
          return;
        }
        if (!cancelled) setCheckingExisting(false);
      })
      .catch(() => {
        // Network error checking status shouldn't block someone from
        // applying — fail open to showing the form.
        if (!cancelled) setCheckingExisting(false);
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setFormError(null);

    if (!form.sellerType) {
      setErrors({ sellerType: "Please choose a seller type." });
      return;
    }
    if (!form.agreeToTerms) {
      setErrors({ agreeToTerms: "You must agree to the Seller Terms to continue." });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/sellers/apply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": getCsrfToken(),
        },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.error?.code === "AUTH_REQUIRED") {
          router.push("/login?next=/seller/apply");
          return;
        }
        const details = data.error?.details;
        if (details && typeof details === "object" && !Array.isArray(details)) {
          const fieldErrors: Record<string, string> = {};
          for (const [key, val] of Object.entries(details)) {
            if (Array.isArray(val) && val[0]) fieldErrors[key] = String(val[0]);
            else if (typeof val === "string") fieldErrors[key] = val;
          }
          if (Object.keys(fieldErrors).length > 0) {
            setErrors(fieldErrors);
            return;
          }
        }
        setFormError(data.error?.message ?? "Something went wrong. Please try again.");
        return;
      }

      setSubmitted(true);
    } catch {
      setFormError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (checkingExisting) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <div className="h-6 w-48 animate-pulse rounded bg-ivoryDark" />
        <div className="mt-4 h-64 animate-pulse rounded-sm bg-ivoryDark" />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 py-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gold/15">
          <svg className="h-8 w-8 text-gold" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
          </svg>
        </div>
        <h1 className="mt-5 font-display text-xl text-charcoal">Check your business email</h1>
        <p className="mt-2 text-sm text-muted">
          We sent a verification link to <strong className="text-charcoal">{form.businessEmail}</strong>.
          Click it to continue to phone verification.
        </p>
        <Link
          href="/seller/status"
          className="mt-6 rounded-sm bg-gold px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-goldDark"
        >
          Check application status
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-12 sm:px-6">
      <h1 className="font-display text-2xl text-charcoal">Become a Seller</h1>
      <p className="mt-2 text-sm text-muted">
        Sell on Nexora's Premium Marketplace. Tell us a bit about your store to get started —
        you'll verify your business email and phone next.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5 rounded-sm border border-ivoryBorder bg-white p-6 shadow-card">
        {formError && (
          <p className="rounded-sm border border-red-200 bg-red-50 p-3 text-sm text-red-700">{formError}</p>
        )}

        {/* Seller type */}
        <div>
          <label className="mb-2 block text-sm font-medium text-charcoal">Seller type</label>
          <div className="grid grid-cols-2 gap-3">
            {(["individual", "business"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => update("sellerType", type)}
                className={`rounded-sm border px-4 py-3 text-sm capitalize transition ${
                  form.sellerType === type
                    ? "border-gold bg-gold/10 text-charcoal font-medium"
                    : "border-ivoryBorder text-muted hover:border-gold/50"
                }`}
              >
                {type}
              </button>
            ))}
          </div>
          {errors.sellerType && <p className="mt-1.5 text-xs text-red-600">{errors.sellerType}</p>}
        </div>

        {/* Display name */}
        <div>
          <label htmlFor="displayName" className="mb-1.5 block text-sm font-medium text-charcoal">
            Store display name
          </label>
          <input
            id="displayName"
            value={form.displayName}
            onChange={(e) => update("displayName", e.target.value)}
            placeholder="e.g. Sialkot Leather Co."
            className="w-full rounded-sm border border-ivoryBorder px-3.5 py-2.5 text-sm text-charcoal outline-none transition placeholder:text-subtle focus:border-gold focus:ring-1 focus:ring-gold/20"
          />
          {errors.displayName && <p className="mt-1.5 text-xs text-red-600">{errors.displayName}</p>}
        </div>

        {/* Business email */}
        <div>
          <label htmlFor="businessEmail" className="mb-1.5 block text-sm font-medium text-charcoal">
            Business email
          </label>
          <input
            id="businessEmail"
            type="email"
            value={form.businessEmail}
            onChange={(e) => update("businessEmail", e.target.value)}
            placeholder="you@yourbusiness.com"
            className="w-full rounded-sm border border-ivoryBorder px-3.5 py-2.5 text-sm text-charcoal outline-none transition placeholder:text-subtle focus:border-gold focus:ring-1 focus:ring-gold/20"
          />
          <p className="mt-1 text-xs text-subtle">Can be different from your login email — we'll verify it separately.</p>
          {errors.businessEmail && <p className="mt-1.5 text-xs text-red-600">{errors.businessEmail}</p>}
        </div>

        {/* Business phone */}
        <div>
          <label htmlFor="businessPhone" className="mb-1.5 block text-sm font-medium text-charcoal">
            Business phone
          </label>
          <input
            id="businessPhone"
            value={form.businessPhone}
            onChange={(e) => update("businessPhone", e.target.value)}
            placeholder="03001234567"
            className="w-full rounded-sm border border-ivoryBorder px-3.5 py-2.5 text-sm text-charcoal outline-none transition placeholder:text-subtle focus:border-gold focus:ring-1 focus:ring-gold/20"
          />
          <p className="mt-1 text-xs text-subtle">We'll text a verification code to this number next.</p>
          {errors.businessPhone && <p className="mt-1.5 text-xs text-red-600">{errors.businessPhone}</p>}
        </div>

        {/* Terms */}
        <div>
          <label className="flex items-start gap-2.5 text-sm text-muted">
            <input
              type="checkbox"
              checked={form.agreeToTerms}
              onChange={(e) => update("agreeToTerms", e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded-sm border-ivoryBorder text-gold focus:ring-gold/30"
            />
            <span>
              I agree to the{" "}
              <Link href="/terms" className="text-gold hover:text-goldDark underline">
                Nexora Seller Terms
              </Link>
            </span>
          </label>
          {errors.agreeToTerms && <p className="mt-1.5 text-xs text-red-600">{errors.agreeToTerms}</p>}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-2 w-full rounded-sm bg-charcoal py-3 text-sm font-semibold text-white transition hover:bg-gold disabled:opacity-50"
        >
          {loading ? "Submitting…" : "Submit Application"}
        </button>
      </form>
    </div>
  );
}
