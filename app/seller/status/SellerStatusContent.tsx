"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface SellerStatus {
  sellerId: string;
  status: string;
  sellerType: "individual" | "business";
  displayName: string | null;
  nextStep: string;
  verification: { emailVerified: boolean; phoneVerified: boolean };
  agreedToTermsAt: string | null;
  createdAt: string;
}

const STEPS = [
  { key: "email", label: "Verify business email" },
  { key: "phone", label: "Verify phone" },
  { key: "kyc", label: "Identity verification (KYC)" },
  { key: "approval", label: "Admin review" },
  { key: "active", label: "Store active" },
] as const;

function stepIndexForStatus(status: string): number {
  switch (status) {
    case "pending":
    case "pending_email_verification":
      return 0;
    case "pending_phone_verification":
      return 1;
    case "pending_kyc":
      return 2;
    case "pending_approval":
      return 3;
    case "active":
      return 4;
    default:
      return -1; // suspended / banned / rejected — no linear position
  }
}

export default function SellerStatusContent() {
  const [data, setData] = useState<{ seller: SellerStatus | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/sellers/status")
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) {
          setError(json.error?.message ?? "Could not load your application status.");
          return;
        }
        setData(json);
      })
      .catch(() => setError("Network error. Please try again."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <div className="h-6 w-48 animate-pulse rounded bg-ivoryDark" />
        <div className="mt-4 h-32 animate-pulse rounded-sm bg-ivoryDark" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <p className="rounded-sm border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>
      </div>
    );
  }

  if (!data?.seller) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center">
        <h1 className="font-display text-xl text-charcoal">No seller application yet</h1>
        <p className="mt-2 text-sm text-muted">You haven't applied to become a Nexora seller.</p>
        <Link
          href="/seller/apply"
          className="mt-6 rounded-sm bg-gold px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-goldDark"
        >
          Become a Seller
        </Link>
      </div>
    );
  }

  const { seller } = data;
  const currentIndex = stepIndexForStatus(seller.status);
  const terminal = seller.status === "suspended" || seller.status === "banned" || seller.status === "rejected";

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <h1 className="font-display text-2xl text-charcoal">
        {seller.displayName ?? "Your"} Seller Application
      </h1>
      <p className="mt-1 text-xs uppercase tracking-wide text-subtle">{seller.sellerType} seller</p>

      <div className="mt-6 rounded-sm border border-ivoryBorder bg-white p-5 shadow-card">
        <p className="text-sm text-charcoal">{seller.nextStep}</p>

        {seller.status === "pending_phone_verification" && (
          <Link
            href="/seller/verify-phone"
            className="mt-4 inline-block rounded-sm bg-gold px-5 py-2 text-sm font-semibold text-white transition hover:bg-goldDark"
          >
            Verify phone now
          </Link>
        )}

        {seller.status === "pending_kyc" && (
          <Link
            href="/seller/verify-kyc"
            className="mt-4 inline-block rounded-sm bg-gold px-5 py-2 text-sm font-semibold text-white transition hover:bg-goldDark"
          >
            Upload documents
          </Link>
        )}

        {seller.status === "active" && (
          <Link
            href="/seller/dashboard"
            className="mt-4 inline-block rounded-sm bg-gold px-5 py-2 text-sm font-semibold text-white transition hover:bg-goldDark"
          >
            Go to Seller Dashboard →
          </Link>
        )}
      </div>

      {!terminal && (
        <ol className="mt-8 flex flex-col gap-4">
          {STEPS.map((step, i) => {
            const isDone = i < currentIndex || seller.status === "active";
            const isCurrent = i === currentIndex && seller.status !== "active";
            return (
              <li key={step.key} className="flex items-center gap-3">
                <span
                  className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    isDone
                      ? "bg-gold text-white"
                      : isCurrent
                      ? "border-2 border-gold text-gold"
                      : "border border-ivoryBorder text-subtle"
                  }`}
                >
                  {isDone ? "✓" : i + 1}
                </span>
                <span className={`text-sm ${isCurrent ? "font-medium text-charcoal" : isDone ? "text-charcoal" : "text-muted"}`}>
                  {step.label}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {terminal && (
        <p className="mt-6 text-sm text-muted">
          Status: <span className="font-medium text-charcoal capitalize">{seller.status}</span>
        </p>
      )}
    </div>
  );
}