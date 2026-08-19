"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { pathForSellerStatus } from "@/lib/sellers/status-routing";

type ViewState = "loading" | "success" | "already_verified" | "error";

export default function SellerVerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [state, setState] = useState<ViewState>("loading");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    const token = searchParams.get("token");

    if (!token) {
      // No token means this isn't someone arriving from an email link —
      // it's someone who navigated here directly (bookmark, back button,
      // typed URL). In that case, send them to whichever step actually
      // matches their current status instead of showing a generic
      // "missing token" error for a page they may have already finished.
      // A genuine email-link visit always includes ?token=, so this
      // branch never fires for the real verification flow.
      fetch("/api/sellers/status")
        .then(async (res) => {
          if (!res.ok) {
            setState("error");
            setMessage("This verification link is missing its token.");
            return;
          }
          const json = await res.json();
          if (json?.seller?.status) {
            router.replace(pathForSellerStatus(json.seller.status));
            return;
          }
          setState("error");
          setMessage("This verification link is missing its token.");
        })
        .catch(() => {
          setState("error");
          setMessage("This verification link is missing its token.");
        });
      return;
    }

    fetch(`/api/sellers/verify-email?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          setState("error");
          setMessage(data.error?.message ?? "This link is invalid or has expired.");
          return;
        }
        setMessage(data.message ?? "");
        setState(data.alreadyVerified ? "already_verified" : "success");
      })
      .catch(() => {
        setState("error");
        setMessage("Network error. Please try again.");
      });
  }, [searchParams, router]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 py-16 text-center">
      {state === "loading" && (
        <>
          <div className="h-10 w-10 animate-pulse rounded-full bg-ivoryDark" />
          <p className="mt-4 text-sm text-muted">Verifying your business email…</p>
        </>
      )}

      {(state === "success" || state === "already_verified") && (
        <>
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gold/15">
            <svg className="h-8 w-8 text-gold" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="mt-5 font-display text-xl text-charcoal">
            {state === "already_verified" ? "Already verified" : "Email verified"}
          </h1>
          <p className="mt-2 text-sm text-muted">{message}</p>
          <Link
            href="/seller/verify-phone"
            className="mt-6 rounded-sm bg-gold px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-goldDark"
          >
            Continue to phone verification
          </Link>
        </>
      )}

      {state === "error" && (
        <>
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <svg className="h-8 w-8 text-red-600" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <h1 className="mt-5 font-display text-xl text-charcoal">Verification failed</h1>
          <p className="mt-2 text-sm text-muted">{message}</p>
          <Link
            href="/seller/status"
            className="mt-6 rounded-sm border border-ivoryBorder px-6 py-2.5 text-sm font-semibold text-charcoal transition hover:border-gold hover:text-gold"
          >
            Check application status
          </Link>
        </>
      )}
    </div>
  );
}
