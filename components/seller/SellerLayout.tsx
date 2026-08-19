// components/seller/SellerLayout.tsx
//
// UPDATE — adds a persistent, unmissable banner shown on EVERY seller
// page when the seller's account is suspended or banned, plus a
// conditional "Appeal" nav link that only appears in that state.
//
// WHY THIS WAS MISSING BEFORE: every seller-scoped API route
// independently checks `seller.status === "active"` and throws the same
// generic ADMIN_UNAUTHORISED error ("You do not have permission to
// perform this action.") with zero context about WHY. A suspended seller
// clicking around Seller Central just saw that message scattered across
// different widgets with no explanation anywhere — this is the fix for
// that: one clear banner, always visible, telling them exactly what
// happened and how to appeal it.
//
// All existing nav items, badges, and the notification bell are
// unchanged from before.

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NAV_ITEMS = [
  { label: "Dashboard",  href: "/seller/dashboard",  icon: "📊" },
  { label: "Analytics",  href: "/seller/analytics",  icon: "📈" },
  { label: "Listings",   href: "/seller/listings",   icon: "📦" },
  { label: "Promotions", href: "/seller/promotions", icon: "🏷️" },
  { label: "Customers",  href: "/seller/customers",  icon: "👥" },
  { label: "Orders",     href: "/seller/orders",     icon: "🧾" },
  { label: "Messages",   href: "/seller/messages",   icon: "✉️" },
  { label: "Disputes",   href: "/seller/disputes",   icon: "⚖️" },
  { label: "Support",    href: "/seller/support",    icon: "🎧" },
  { label: "Wallet",     href: "/seller/wallet",     icon: "💰" },
  { label: "Payouts",    href: "/seller/payouts",    icon: "🏦" },
  { label: "Banking",    href: "/seller/banking",    icon: "🔐" },
  { label: "My Store",   href: "/seller/store",      icon: "🏪" },
  { label: "Settings",   href: "/seller/settings",   icon: "⚙️" },
  { label: "Billing",    href: "/seller/billing",    icon: "💳" },
];

interface SellerStatusInfo {
  status: string;
  banReason: string | null;
  bannedAt: string | null;
  suspendedUntil: string | null;
  appeal: { id: string; status: string } | null;
}

const APPEAL_STATUS_LABELS: Record<string, string> = {
  open: "Awaiting your response",
  seller_replied: "Sent — awaiting admin review",
  admin_replied: "Admin has replied — check your appeal",
  resolved_upheld: "Reviewed — decision upheld",
  resolved_lifted: "Reviewed — approved",
};

export function SellerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [pendingOrders, setPendingOrders]     = useState<number | null>(null);
  const [openDisputes, setOpenDisputes]       = useState<number | null>(null);
  const [unreadMessages, setUnreadMessages]   = useState<number | null>(null);
  const [unreadNotifs, setUnreadNotifs]       = useState<number | null>(null);
  const [sellerStatus, setSellerStatus]       = useState<SellerStatusInfo | null>(null);
  const [statusLoaded, setStatusLoaded]       = useState(false);

  useEffect(() => {
    fetch("/api/sellers/orders?status=pending&pageSize=1")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.counts) setPendingOrders(d.counts.pending ?? 0); })
      .catch(() => {});

    fetch("/api/sellers/disputes?status=open&pageSize=1")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (typeof d?.total === "number") setOpenDisputes(d.total); })
      .catch(() => {});

    fetch("/api/sellers/messages/unread")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (typeof d?.unread === "number") setUnreadMessages(d.unread); })
      .catch(() => {});

    fetch("/api/sellers/notifications?unreadOnly=true&pageSize=1")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (typeof d?.unreadCount === "number") setUnreadNotifs(d.unreadCount); })
      .catch(() => {});

    // NEW: fetch the seller's own enforcement status — this is what
    // drives the banner and the conditional Appeal nav link below.
    fetch("/api/sellers/me/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setSellerStatus(d); })
      .catch(() => {})
      .finally(() => setStatusLoaded(true));
  }, []);

  const isEnforced = sellerStatus?.status === "suspended" || sellerStatus?.status === "banned";
  const isBanned = sellerStatus?.status === "banned";

  const navItems = isEnforced
    ? [
        ...NAV_ITEMS,
        { label: "Appeal", href: "/seller/appeal", icon: "📨" },
      ]
    : NAV_ITEMS;

  return (
    <div className="flex min-h-screen bg-ivory">
      {/* ── Suspension / Ban banner — shown on EVERY seller page ─────────── */}
      {statusLoaded && isEnforced && (
        <div
          className={`fixed inset-x-0 top-0 z-50 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2.5 text-center text-sm font-medium text-white ${
            isBanned ? "bg-red-700" : "bg-amber-600"
          }`}
        >
          <span>
            {isBanned ? "🚫 Your seller account has been banned." : "⏸ Your seller account is suspended."}
            {sellerStatus?.banReason && (
              <span className="font-normal"> Reason: {sellerStatus.banReason}</span>
            )}
            {!isBanned && sellerStatus?.suspendedUntil && (
              <span className="font-normal">
                {" "}— until {new Date(sellerStatus.suspendedUntil).toLocaleDateString()}
              </span>
            )}
          </span>
          <Link
            href="/seller/appeal"
            className="rounded-sm bg-white/20 px-3 py-1 text-xs font-semibold underline decoration-2 underline-offset-2 transition hover:bg-white/30"
          >
            {sellerStatus?.appeal
              ? APPEAL_STATUS_LABELS[sellerStatus.appeal.status] ?? "View your appeal"
              : "Appeal this decision →"}
          </Link>
        </div>
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 flex w-[200px] flex-col border-r border-ivoryBorder bg-white ${
          statusLoaded && isEnforced ? "mt-10" : ""
        }`}
      >
        <div className="flex h-14 items-center justify-between border-b border-ivoryBorder px-4">
          <Link href="/" className="font-display text-sm tracking-widest text-charcoal uppercase">
            Seller Central
          </Link>
          <Link
            href="/seller/notifications"
            className="relative rounded-sm p-1 text-muted transition hover:text-charcoal"
            title="Notifications"
          >
            <span className="text-base">🔔</span>
            {!!unreadNotifs && unreadNotifs > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold text-white">
                {unreadNotifs > 99 ? "99+" : unreadNotifs}
              </span>
            )}
          </Link>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto py-4 px-2">
          {navItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            const isAppealLink = item.href === "/seller/appeal";
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between rounded-sm px-3 py-2 text-sm transition ${
                  isAppealLink
                    ? active
                      ? "bg-red-100 text-red-700 font-semibold"
                      : "text-red-600 font-medium hover:bg-red-50"
                    : active
                    ? "bg-gold/10 text-gold font-medium"
                    : "text-muted hover:bg-ivoryDark hover:text-charcoal"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <span className="text-base">{item.icon}</span>
                  {item.label}
                </span>
                {item.href === "/seller/orders" && !!pendingOrders && pendingOrders > 0 && (
                  <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold text-white">
                    {pendingOrders}
                  </span>
                )}
                {item.href === "/seller/disputes" && !!openDisputes && openDisputes > 0 && (
                  <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {openDisputes}
                  </span>
                )}
                {item.href === "/seller/messages" && !!unreadMessages && unreadMessages > 0 && (
                  <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-bold text-white">
                    {unreadMessages}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-ivoryBorder p-3">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-sm px-3 py-2 text-sm text-muted transition hover:text-charcoal"
          >
            <span>←</span>
            <span>Back to Store</span>
          </Link>
        </div>
      </aside>

      {/* Main */}
      <main className={`ml-[200px] flex-1 px-8 py-8 ${statusLoaded && isEnforced ? "mt-10" : ""}`}>
        {children}
      </main>
    </div>
  );
}
