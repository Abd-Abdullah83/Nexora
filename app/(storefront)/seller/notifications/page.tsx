"use client";
// app/(storefront)/seller/notifications/page.tsx
// Phase 10 gap fill: In-app notification feed for sellers.
// Displays order, dispute, payout, moderation and support events.

import { useState, useEffect, useCallback } from "react";
import { SellerLayout } from "@/components/seller/SellerLayout";

interface Notification {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

interface NotificationsResponse {
  items: Notification[];
  total: number;
  unreadCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

function getCsrf() {
  return document.cookie.split("; ").find((c) => c.startsWith("csrf_token="))?.split("=")[1] ?? "";
}

const TYPE_LABELS: Record<string, { label: string; icon: string }> = {
  order_status_changed: { label: "Order Update",        icon: "🧾" },
  dispute_opened:       { label: "Dispute Opened",      icon: "⚖️" },
  dispute_resolved:     { label: "Dispute Resolved",    icon: "✅" },
  payout_paid:          { label: "Payout Sent",         icon: "💰" },
  payout_failed:        { label: "Payout Failed",       icon: "❌" },
  listing_moderation:   { label: "Listing Review",      icon: "📋" },
  support_ticket_reply: { label: "Support Reply",       icon: "💬" },
};

function NotificationBody({ type, payload }: { type: string; payload: Record<string, unknown> }) {
  switch (type) {
    case "order_status_changed":
      return (
        <p className="text-sm text-muted">
          Your item <strong className="text-charcoal">{String(payload.productName ?? "")}</strong> is now{" "}
          <strong>{String(payload.newStatus ?? "")}</strong>.
        </p>
      );
    case "dispute_opened":
      return (
        <p className="text-sm text-muted">
          A dispute was opened on order item{" "}
          <strong className="text-charcoal">{String(payload.orderItemId ?? "").slice(0, 8)}…</strong>.
          Please respond within 48 hours.
        </p>
      );
    case "dispute_resolved":
      return (
        <p className="text-sm text-muted">
          Dispute <strong className="text-charcoal">{String(payload.disputeId ?? "").slice(0, 8)}…</strong>{" "}
          was resolved: <strong>{String(payload.outcome ?? "")}</strong>.
        </p>
      );
    case "payout_paid":
      return (
        <p className="text-sm text-muted">
          Your payout of <strong className="text-emerald-600">
            {String(payload.currency ?? "PKR")} {String(payload.amount ?? "")}
          </strong> has been sent to your bank account.
        </p>
      );
    case "payout_failed":
      return (
        <p className="text-sm text-muted">
          A payout could not be processed.{" "}
          {!!payload.reason && <span>Reason: <em>{String(payload.reason)}</em>.</span>}{" "}
          Please check your banking details.
        </p>
      );
    case "listing_moderation": {
      const outcome = payload.outcome;
      return (
        <p className="text-sm text-muted">
          {outcome === "pending"
            ? "One of your listings has been flagged for manual review. It has been set to Draft until reviewed."
            : outcome === "cleared"
            ? "Your listing has been reviewed and cleared. You can now activate it."
            : `Your listing was rejected${payload.note ? `: "${String(payload.note)}"` : ". Please edit and resubmit."}`}
        </p>
      );
    }
    case "support_ticket_reply":
      return (
        <p className="text-sm text-muted">
          {payload.resolved
            ? `Your support ticket "${String(payload.subject ?? "")}" has been resolved.`
            : `Admin replied to your support ticket: "${String(payload.subject ?? "")}".`}
        </p>
      );
    default:
      return <p className="text-sm text-muted">{type.replace(/_/g, " ")}</p>;
  }
}

export default function SellerNotificationsPage() {
  const [data, setData] = useState<NotificationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (unreadOnly) params.set("unreadOnly", "true");
      const res = await fetch(`/api/sellers/notifications?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Failed to load notifications.");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error loading notifications.");
    } finally {
      setLoading(false);
    }
  }, [page, unreadOnly]);

  useEffect(() => { load(); }, [load]);

  async function markRead(id: string) {
    await fetch("/api/sellers/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-csrf-token": getCsrf() },
      body: JSON.stringify({ action: "mark_read", notificationId: id }),
    });
    setData((prev) =>
      prev
        ? {
            ...prev,
            items: prev.items.map((n) =>
              n.id === id ? { ...n, readAt: new Date().toISOString() } : n
            ),
            unreadCount: Math.max(0, prev.unreadCount - 1),
          }
        : prev
    );
  }

  async function markAllRead() {
    setActing(true);
    await fetch("/api/sellers/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-csrf-token": getCsrf() },
      body: JSON.stringify({ action: "mark_all_read" }),
    });
    setActing(false);
    load();
  }

  return (
    <SellerLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl text-charcoal">Notifications</h1>
          {data && data.unreadCount > 0 && (
            <p className="mt-1 text-sm text-muted">{data.unreadCount} unread</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-muted cursor-pointer">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(e) => { setUnreadOnly(e.target.checked); setPage(1); }}
              className="rounded border-ivoryBorder"
            />
            Unread only
          </label>
          {data && data.unreadCount > 0 && (
            <button
              onClick={markAllRead}
              disabled={acting}
              className="rounded-sm border border-ivoryBorder px-3 py-1.5 text-xs text-charcoal transition hover:border-gold hover:text-gold disabled:opacity-50"
            >
              Mark all read
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-sm border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {loading && !data ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg border border-ivoryBorder bg-ivoryDark" />
          ))}
        </div>
      ) : !data || data.items.length === 0 ? (
        <div className="rounded-lg border border-ivoryBorder bg-white px-6 py-16 text-center">
          <p className="text-2xl mb-2">🔔</p>
          <p className="text-sm text-muted">
            {unreadOnly ? "No unread notifications." : "No notifications yet. They'll appear here as things happen on your store."}
          </p>
        </div>
      ) : (
        <>
          <div className="divide-y divide-ivoryBorder rounded-lg border border-ivoryBorder bg-white overflow-hidden">
            {data.items.map((n) => {
              const meta = TYPE_LABELS[n.type] ?? { label: n.type, icon: "📣" };
              const isUnread = !n.readAt;
              return (
                <div
                  key={n.id}
                  className={`flex items-start gap-4 px-5 py-4 transition ${isUnread ? "bg-gold/5" : ""}`}
                >
                  <span className="mt-0.5 text-xl flex-shrink-0">{meta.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold uppercase tracking-wider mb-0.5 ${isUnread ? "text-gold" : "text-muted"}`}>
                      {meta.label}
                    </p>
                    <NotificationBody type={n.type} payload={n.payload} />
                    <p className="mt-1 text-xs text-subtle">
                      {new Date(n.createdAt).toLocaleString("en-PK")}
                    </p>
                  </div>
                  {isUnread && (
                    <button
                      onClick={() => markRead(n.id)}
                      className="flex-shrink-0 text-xs text-muted transition hover:text-gold"
                    >
                      Mark read
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {data.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-3 text-sm">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-sm border border-ivoryBorder px-3 py-1.5 text-charcoal disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-muted">Page {data.page} of {data.totalPages}</span>
              <button
                disabled={page >= data.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-sm border border-ivoryBorder px-3 py-1.5 text-charcoal disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </SellerLayout>
  );
}
