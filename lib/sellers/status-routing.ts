// ─────────────────────────────────────────────────────────────────────────
// lib/sellers/status-routing.ts
//
// Single source of truth for "given a seller's current status, which
// /seller/* page should they actually be on right now?" Used by every
// seller onboarding page to redirect a seller who lands on the wrong
// step — e.g. someone who already verified their email but bookmarked
// or re-visits /seller/verify-email should be bounced straight to
// /seller/verify-phone, not shown a redundant or stale verification form.
//
// Deliberately kept as a tiny, framework-agnostic function (no Next.js
// imports) so both server components (page.tsx wrappers, if ever needed)
// and client components (the existing content components, which already
// fetch /api/sellers/status) can import it without restriction.
// ─────────────────────────────────────────────────────────────────────────

export type SellerStatusValue =
  | "pending"
  | "pending_email_verification"
  | "pending_phone_verification"
  | "pending_kyc"
  | "pending_approval"
  | "active"
  | "suspended"
  | "banned"
  | "rejected";

/**
 * Returns the one /seller/* path that correctly corresponds to the
 * action a seller in this status should be taking right now.
 *
 * `pending_approval`, `suspended`, `banned`, and `rejected` map to
 * /seller/status because there is no further *action* to take on a
 * dedicated page for any of them yet (pending_approval = wait,
 * suspended/banned/rejected = terminal-ish, explained on the status page
 * itself). `active` now maps to /seller/dashboard — Phase 4's Seller
 * Central home screen.
 */
export function pathForSellerStatus(status: SellerStatusValue | string): string {
  switch (status) {
    case "pending":
    case "pending_email_verification":
      return "/seller/verify-email";
    case "pending_phone_verification":
      return "/seller/verify-phone";
    case "pending_kyc":
      return "/seller/verify-kyc";
    case "active":
      return "/seller/dashboard";
    case "pending_approval":
    case "suspended":
    case "banned":
    case "rejected":
    default:
      return "/seller/status";
  }
}

/**
 * Convenience check for a page to call after fetching seller status:
 * "is this page still the correct one for this seller, or should I
 * redirect them?" Pass the current page's own path (e.g.
 * "/seller/verify-phone") and the seller's current status.
 */
export function isCorrectPageForStatus(
  currentPath: string,
  status: SellerStatusValue | string
): boolean {
  return pathForSellerStatus(status) === currentPath;
}
