"use client";

import { useEffect, useState, useCallback } from "react";
import { SellerLayout } from "@/components/seller/SellerLayout";
import Link from "next/link";

function getCsrf() {
  return document.cookie.split("; ").find((c) => c.startsWith("csrf_token="))?.split("=")[1] ?? "";
}

interface PayoutRequest {
  id: string;
  amount: string;
  currency: string;
  status: "requested" | "processing" | "paid" | "failed" | "cancelled";
  bankAccountSnapshot: { bankName: string; accountNumberMasked: string; isVerified: boolean };
  adminNote: string | null;
  requestedAt: string;
  processedAt: string | null;
}

interface HistoryData {
  items: PayoutRequest[];
  total: number;
  totalPages: number;
}

interface WalletSummary {
  availableBalance: string;
  pendingBalance: string;
  currency: string;
}

const STATUS_STYLES: Record<string, string> = {
  requested: "bg-gold/15 text-gold",
  processing: "bg-blue-100 text-blue-700",
  paid: "bg-emerald/15 text-emerald",
  failed: "bg-red-100 text-red-700",
  cancelled: "bg-ivoryDark text-subtle",
};

function fmt(amount: string | number, currency = "PKR") {
  return `${currency} ${Number(amount).toLocaleString("en-PK", { minimumFractionDigits: 2 })}`;
}

export default function SellerPayoutsPage() {
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [history, setHistory] = useState<HistoryData | null>(null);
  const [hasBankAccount, setHasBankAccount] = useState<boolean | null>(null);
  const [bankVerified, setBankVerified] = useState(false);
  const [page, setPage] = useState(1);
  const [loadingData, setLoadingData] = useState(true);

  // Request form
  const [amount, setAmount] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [reqError, setReqError] = useState<string | null>(null);
  const [reqSuccess, setReqSuccess] = useState(false);

  const loadAll = useCallback(async () => {
    setLoadingData(true);
    try {
      const [walletRes, histRes, bankRes] = await Promise.all([
        fetch("/api/sellers/wallet"),
        fetch(`/api/sellers/payouts?page=${page}&pageSize=15`),
        fetch("/api/sellers/bank-account"),
      ]);
      const [walletJson, histJson, bankJson] = await Promise.all([
        walletRes.json(), histRes.json(), bankRes.json(),
      ]);
      if (walletRes.ok) setWallet(walletJson.wallet);
      if (histRes.ok) setHistory(histJson);
      if (bankRes.ok) {
        setHasBankAccount(!!bankJson.account);
        setBankVerified(bankJson.account?.isVerified ?? false);
      }
    } finally {
      setLoadingData(false);
    }
  }, [page]);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault();
    setReqError(null);
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) { setReqError("Enter a valid amount."); return; }
    setRequesting(true);
    try {
      const res = await fetch("/api/sellers/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrf() },
        body: JSON.stringify({ amount: parsed, currency: wallet?.currency ?? "PKR" }),
      });
      const json = await res.json();
      if (!res.ok) {
        setReqError(json.error?.details?.amount ?? json.error?.details?.status ?? json.error?.message ?? "Request failed.");
        return;
      }
      setAmount("");
      setReqSuccess(true);
      setTimeout(() => setReqSuccess(false), 4000);
      loadAll();
    } catch { setReqError("Network error."); }
    finally { setRequesting(false); }
  }

  async function cancelPayout(id: string) {
    const res = await fetch(`/api/sellers/payouts/${id}`, {
      method: "DELETE",
      headers: { "x-csrf-token": getCsrf() },
    });
    if (res.ok) loadAll();
  }

  const hasActivePayout = history?.items.some(
    (p) => p.status === "requested" || p.status === "processing"
  );
  const available = wallet ? Number(wallet.availableBalance) : 0;
  const canRequest = hasBankAccount && bankVerified && !hasActivePayout && available >= 500;

  return (
    <SellerLayout>
      <h1 className="font-display text-2xl text-charcoal">Payouts</h1>
      <p className="mt-1 text-sm text-muted">Withdraw your available balance to your bank account.</p>

      {loadingData && !wallet && (
        <div className="mt-6 space-y-4">
          {[1,2,3].map((i) => <div key={i} className="h-16 animate-pulse rounded-sm bg-ivoryDark" />)}
        </div>
      )}

      {wallet && (
        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className="rounded-sm border border-ivoryBorder bg-white p-4 shadow-card">
            <p className="text-xs text-muted">Available balance</p>
            <p className="mt-1 text-xl font-semibold text-charcoal">{fmt(wallet.availableBalance, wallet.currency)}</p>
          </div>
          <div className="rounded-sm border border-ivoryBorder bg-white p-4 shadow-card">
            <p className="text-xs text-muted">Pending (in escrow)</p>
            <p className="mt-1 text-xl font-semibold text-subtle">{fmt(wallet.pendingBalance, wallet.currency)}</p>
          </div>
        </div>
      )}

      {/* Pre-flight checks */}
      {hasBankAccount === false && (
        <div className="mt-4 rounded-sm border border-gold/30 bg-gold/5 p-4">
          <p className="text-sm font-medium text-charcoal">No bank account added</p>
          <p className="mt-1 text-xs text-muted">Add a bank account before requesting a payout.</p>
          <Link href="/seller/banking" className="mt-3 inline-block text-xs text-gold underline hover:text-goldDark">
            Add bank account →
          </Link>
        </div>
      )}
      {hasBankAccount && !bankVerified && (
        <div className="mt-4 rounded-sm border border-gold/30 bg-gold/5 p-4">
          <p className="text-sm font-medium text-charcoal">Bank account pending verification</p>
          <p className="mt-1 text-xs text-muted">
            An admin is verifying your bank account. You'll be able to request payouts once it's confirmed.
          </p>
        </div>
      )}
      {hasActivePayout && (
        <div className="mt-4 rounded-sm border border-ivoryBorder bg-white p-4">
          <p className="text-sm text-muted">You have a payout in progress. Wait for it to complete before requesting another.</p>
        </div>
      )}

      {/* Request form */}
      {canRequest && (
        <form onSubmit={handleRequest} className="mt-6 rounded-sm border border-ivoryBorder bg-white p-5 shadow-card">
          <h2 className="mb-3 text-sm font-medium text-charcoal">Request a payout</h2>
          {reqError && <p className="mb-3 rounded-sm border border-red-200 bg-red-50 p-2.5 text-sm text-red-700">{reqError}</p>}
          {reqSuccess && <p className="mb-3 text-sm text-emerald">✓ Payout requested — it will be reviewed shortly.</p>}
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="mb-1.5 block text-xs text-muted">Amount (PKR, minimum 500)</label>
              <input type="number" min={500} max={available} step={1} value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={`Max ${fmt(available)}`}
                className="w-full rounded-sm border border-ivoryBorder px-3.5 py-2.5 text-sm text-charcoal outline-none focus:border-gold" />
            </div>
            <button type="button" onClick={() => setAmount(String(Math.floor(available)))}
              className="self-end mb-0.5 text-xs text-gold underline hover:text-goldDark whitespace-nowrap">
              Max
            </button>
            <button type="submit" disabled={requesting}
              className="rounded-sm bg-charcoal px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-gold disabled:opacity-50 whitespace-nowrap">
              {requesting ? "Requesting…" : "Request Payout"}
            </button>
          </div>
        </form>
      )}

      {/* History */}
      <div className="mt-8">
        <h2 className="mb-4 text-sm font-medium text-charcoal">Payout history</h2>
        {history && history.items.length === 0 && (
          <p className="text-sm text-muted">No payout requests yet.</p>
        )}
        {history && history.items.length > 0 && (
          <div className="overflow-hidden rounded-sm border border-ivoryBorder">
            <table className="w-full text-sm">
              <thead className="bg-ivory">
                <tr>
                  {["Date", "Amount", "Bank", "Status", ""].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-muted">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-ivoryBorder bg-white">
                {history.items.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3 text-xs text-muted whitespace-nowrap">
                      {new Date(p.requestedAt).toLocaleDateString("en-PK")}
                    </td>
                    <td className="px-4 py-3 font-medium text-charcoal">{fmt(p.amount, p.currency)}</td>
                    <td className="px-4 py-3 text-xs text-muted">
                      {p.bankAccountSnapshot.bankName} · {p.bankAccountSnapshot.accountNumberMasked}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-sm px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[p.status] ?? ""}`}>
                        {p.status}
                      </span>
                      {p.adminNote && p.status === "failed" && (
                        <p className="mt-0.5 text-xs text-red-600">{p.adminNote}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {p.status === "requested" && (
                        <button onClick={() => cancelPayout(p.id)}
                          className="text-xs text-muted hover:text-red-600 underline">
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {history.totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-ivoryBorder bg-ivory px-4 py-2.5">
                <p className="text-xs text-muted">Page {page} of {history.totalPages}</p>
                <div className="flex gap-2">
                  <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}
                    className="text-xs text-gold disabled:text-subtle">← Prev</button>
                  <button disabled={page === history.totalPages} onClick={() => setPage((p) => p + 1)}
                    className="text-xs text-gold disabled:text-subtle">Next →</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </SellerLayout>
  );
}
