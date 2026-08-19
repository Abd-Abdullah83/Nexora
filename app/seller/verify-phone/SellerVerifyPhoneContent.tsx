"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { pathForSellerStatus } from "@/lib/sellers/status-routing";

function getCsrfToken(): string {
  return (
    document.cookie
      .split("; ")
      .find((c) => c.startsWith("csrf_token="))
      ?.split("=")[1] ?? ""
  );
}

export default function SellerVerifyPhoneContent() {
  const router = useRouter();
  const [step, setStep] = useState<"request" | "verify">("request");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // See SellerApplyForm.tsx / SellerVerifyEmailContent.tsx for the same
  // pattern. Starts true so the form never flashes before we've confirmed
  // this seller's status is actually pending_phone_verification.
  const [checkingStatus, setCheckingStatus] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/sellers/status")
      .then(async (res) => {
        if (!res.ok) {
          // Not authenticated, or no application — let the page render;
          // requestOtp() below already redirects to /login on
          // AUTH_REQUIRED, and a missing application will simply fail
          // there too with a clear error rather than a silent redirect
          // loop.
          if (!cancelled) setCheckingStatus(false);
          return;
        }
        const json = await res.json();
        const status = json?.seller?.status;
        if (status && status !== "pending_phone_verification") {
          router.replace(pathForSellerStatus(status));
          return;
        }
        if (!cancelled) setCheckingStatus(false);
      })
      .catch(() => {
        if (!cancelled) setCheckingStatus(false);
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function requestOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/sellers/phone/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrfToken() },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error?.code === "AUTH_REQUIRED") {
          router.push("/login?next=/seller/verify-phone");
          return;
        }
        setError(data.error?.message ?? "Could not send OTP. Please try again.");
        return;
      }
      setInfo(data.message);
      setStep("verify");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/sellers/phone/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrfToken() },
        body: JSON.stringify({ phone, code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? "Invalid or expired code.");
        return;
      }
      // Phone verification advances status to pending_kyc — go straight
      // to the KYC upload page instead of bouncing through /seller/status
      // first. (Previously this always went to /seller/status; now it
      // matches the "skip to the correct step" behavior added across the
      // other seller onboarding pages.)
      router.push("/seller/verify-kyc");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (checkingStatus) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <div className="h-6 w-48 animate-pulse rounded bg-ivoryDark" />
        <div className="mt-4 h-40 animate-pulse rounded-sm bg-ivoryDark" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="font-display text-2xl text-charcoal">Verify your phone</h1>
      <p className="mt-2 text-sm text-muted">
        {step === "request"
          ? "Enter your business phone number — we'll text you a 6-digit code."
          : `We sent a code to ${phone}. It expires in 10 minutes.`}
      </p>

      {process.env.NODE_ENV !== "production" && (
        <p className="mt-3 rounded-sm border border-gold/30 bg-gold/5 p-3 text-xs leading-relaxed text-charcoal/80">
          Dev mode: no SMS provider is wired up yet — check the terminal running{" "}
          <code>npm run dev</code> for a line like{" "}
          <code>[DEV] OTP for 03001234567: 482913</code>.
        </p>
      )}

      {error && (
        <p className="mt-4 rounded-sm border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}
      {info && step === "verify" && (
        <p className="mt-4 rounded-sm border border-gold/30 bg-gold/5 p-3 text-sm text-charcoal">{info}</p>
      )}

      {step === "request" ? (
        <form onSubmit={requestOtp} className="mt-6 flex flex-col gap-4">
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="03001234567"
            required
            className="w-full rounded-sm border border-ivoryBorder px-3.5 py-2.5 text-sm text-charcoal outline-none transition placeholder:text-subtle focus:border-gold focus:ring-1 focus:ring-gold/20"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-sm bg-charcoal py-3 text-sm font-semibold text-white transition hover:bg-gold disabled:opacity-50"
          >
            {loading ? "Sending…" : "Send Code"}
          </button>
        </form>
      ) : (
        <form onSubmit={verifyOtp} className="mt-6 flex flex-col gap-4">
          <input
            type="text"
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="6-digit code"
            required
            maxLength={6}
            className="w-full rounded-sm border border-ivoryBorder px-3.5 py-2.5 text-center text-lg tracking-[0.4em] text-charcoal outline-none transition placeholder:text-subtle placeholder:tracking-normal placeholder:text-sm focus:border-gold focus:ring-1 focus:ring-gold/20"
          />
          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="w-full rounded-sm bg-charcoal py-3 text-sm font-semibold text-white transition hover:bg-gold disabled:opacity-50"
          >
            {loading ? "Verifying…" : "Verify Code"}
          </button>
          <button
            type="button"
            onClick={() => setStep("request")}
            className="text-xs text-muted underline hover:text-gold"
          >
            Use a different number / resend
          </button>
        </form>
      )}
    </div>
  );
}
