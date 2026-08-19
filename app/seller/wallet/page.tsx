"use client";

import { useEffect, useState, useCallback } from "react";
import { SellerLayout } from "@/components/seller/SellerLayout";

interface Wallet {
  pendingBalance: string | number;
  availableBalance: string | number;
  heldBalance: string | number;
  currency: string;
}

interface LedgerEntry {
  id: string;
  entryType:
    | "escrow_hold"
    | "commission"
    | "subscription_fee"
    | "release"
    | "refund"
    | "payout"
    | "adjustment";
  amount: string | number;
  balanceAfter: string | number;
  note: string | null;
  createdAt: string;
}

interface UpcomingRelease {
  id: string;
  status: "held" | "frozen";
  grossAmount: string | number;
  deliveredAt: string | null;
  releaseEligibleAt: string | null;
  freezeReason: string | null;
  orderItem: { productName: string; orderId: string };
}

interface WalletResponse {
  wallet: Wallet;
  ledger: { items: LedgerEntry[]; total: number; page: number; totalPages: number };
  upcomingReleases: UpcomingRelease[];
}

const ENTRY_TYPE_LABELS: Record<string, string> = {
  escrow_hold: "Order held",
  commission: "Platform commission",
  subscription_fee: "Subscription fee",
  release: "Released to balance",
  refund: "Refunded to buyer",
  payout: "Paid out",
  adjustment: "Manual adjustment",
};

const ENTRY_TYPE_STYLES: Record<string, string> = {
  escrow_hold: "text-amber-700",
  commission: "text-red-600",
  subscription_fee: "text-red-600",
  release: "text-emerald-700",
  refund: "text-red-600",
  payout: "text-blue-700",
  adjustment: "text-purple-700",
};

function formatMoney(value: string | number, currency: string): string {
  const n = typeof value === "string" ? Number(value) : value;
  return `${currency} ${n.toFixed(2)}`;
}

function daysUntil(dateStr: string | null): string {
  if (!dateStr) return "—";
  const diffMs = new Date(dateStr).getTime() - Date.now();
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (days <= 0) return "Eligible now";
  return `${days} day${days === 1 ? "" : "s"} left`;
}

export default function SellerWalletPage() {
  const [data, setData] = useState<WalletResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/sellers/wallet?page=${page}&pageSize=20`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error?.message ?? "Could not load wallet.");
        return;
      }
      setData(json);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !data) {
    return (
      <SellerLayout>
        <p className="text-sm text-muted">Loading wallet…</p>
      </SellerLayout>
    );
  }

  if (error) {
    return (
      <SellerLayout>
        <div className="rounded-sm border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      </SellerLayout>
    );
  }

  if (!data) return null;

  const { wallet, ledger, upcomingReleases } = data;
  const currency = wallet.currency || "PKR";

  return (
    <SellerLayout>
      <h1 className="mb-1 font-display text-2xl text-charcoal">Wallet</h1>
      <p className="mb-6 text-sm text-muted">
        Track your balances, upcoming releases, and full transaction history.
      </p>

      {/* ── Balance cards ── */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-sm border border-ivoryBorder bg-white p-5">
          <p className="text-xs uppercase tracking-wide text-muted">Available Balance</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-700">
            {formatMoney(wallet.availableBalance, currency)}
          </p>
          <p className="mt-1 text-xs text-muted">Ready to withdraw</p>
        </div>

        <div className="rounded-sm border border-ivoryBorder bg-white p-5">
          <p className="text-xs uppercase tracking-wide text-muted">Pending Balance</p>
          <p className="mt-2 text-2xl font-semibold text-amber-700">
            {formatMoney(wallet.pendingBalance, currency)}
          </p>
          <p className="mt-1 text-xs text-muted">Held for active escrow</p>
        </div>

        <div className="rounded-sm border border-ivoryBorder bg-white p-5">
          <p className="text-xs uppercase tracking-wide text-muted">Frozen Balance</p>
          <p className="mt-2 text-2xl font-semibold text-red-700">
            {formatMoney(wallet.heldBalance, currency)}
          </p>
          <p className="mt-1 text-xs text-muted">Under admin review</p>
        </div>
      </div>

      {/* ── Upcoming releases ── */}
      <div className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-charcoal">Upcoming Releases</h2>
        {upcomingReleases.length === 0 ? (
          <div className="rounded-sm border border-ivoryBorder bg-white px-4 py-6 text-center text-sm text-muted">
            No pending escrow holds right now.
          </div>
        ) : (
          <div className="overflow-hidden rounded-sm border border-ivoryBorder bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-ivoryBorder bg-ivory text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Delivered</th>
                  <th className="px-4 py-3">Release</th>
                </tr>
              </thead>
              <tbody>
                {upcomingReleases.map((item) => (
                  <tr key={item.id} className="border-b border-ivoryBorder last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium text-charcoal">{item.orderItem.productName}</p>
                      <p className="text-xs text-muted">Order #{item.orderItem.orderId.slice(0, 8)}</p>
                    </td>
                    <td className="px-4 py-3 font-medium text-charcoal">
                      {formatMoney(item.grossAmount, currency)}
                    </td>
                    <td className="px-4 py-3">
                      {item.status === "frozen" ? (
                        <span
                          className="inline-flex rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700"
                          title={item.freezeReason ?? undefined}
                        >
                          Frozen
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                          Held
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {item.deliveredAt ? new Date(item.deliveredAt).toLocaleDateString() : "Not yet delivered"}
                    </td>
                    <td className="px-4 py-3">
                      {item.status === "frozen" ? (
                        <span className="text-red-600">On hold — contact support</span>
                      ) : (
                        <span className={daysUntil(item.releaseEligibleAt) === "Eligible now" ? "font-medium text-emerald-700" : "text-charcoal"}>
                          {daysUntil(item.releaseEligibleAt)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Transaction history ── */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-charcoal">Transaction History</h2>
        {ledger.items.length === 0 ? (
          <div className="rounded-sm border border-ivoryBorder bg-white px-4 py-6 text-center text-sm text-muted">
            No transactions yet.
          </div>
        ) : (
          <>
            <div className="overflow-hidden rounded-sm border border-ivoryBorder bg-white">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-ivoryBorder bg-ivory text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Note</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3 text-right">Balance After</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.items.map((entry) => {
                    const amountNum = typeof entry.amount === "string" ? Number(entry.amount) : entry.amount;
                    return (
                      <tr key={entry.id} className="border-b border-ivoryBorder last:border-0">
                        <td className="px-4 py-3 text-muted">
                          {new Date(entry.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`font-medium ${ENTRY_TYPE_STYLES[entry.entryType] ?? "text-charcoal"}`}>
                            {ENTRY_TYPE_LABELS[entry.entryType] ?? entry.entryType}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted">{entry.note ?? "—"}</td>
                        <td className={`px-4 py-3 text-right font-medium ${amountNum >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                          {amountNum >= 0 ? "+" : ""}{formatMoney(entry.amount, currency)}
                        </td>
                        <td className="px-4 py-3 text-right text-charcoal">
                          {formatMoney(entry.balanceAfter, currency)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {ledger.totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between text-sm">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded-sm border border-ivoryBorder px-3 py-1.5 text-muted disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="text-muted">
                  Page {ledger.page} of {ledger.totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(ledger.totalPages, p + 1))}
                  disabled={page >= ledger.totalPages}
                  className="rounded-sm border border-ivoryBorder px-3 py-1.5 text-muted disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </SellerLayout>
  );
}
