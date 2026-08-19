"use client";

import { useEffect, useState } from "react";
import { SellerLayout } from "@/components/seller/SellerLayout";

function getCsrf() {
  return document.cookie.split("; ").find((c) => c.startsWith("csrf_token="))?.split("=")[1] ?? "";
}

interface BankAccount {
  id: string;
  accountHolderName: string;
  bankName: string;
  accountNumber: string; // always masked from the API
  routingCode: string | null;
  accountType: string;
  isVerified: boolean;
  updatedAt: string;
}

export default function SellerBankingPage() {
  const [account, setAccount] = useState<BankAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    accountHolderName: "",
    bankName: "",
    accountNumber: "",
    routingCode: "",
    accountType: "current" as "current" | "savings",
  });

  useEffect(() => {
    fetch("/api/sellers/bank-account")
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) { setError(json.error?.message ?? "Could not load banking info."); return; }
        if (json.account) {
          setAccount(json.account);
          setForm((f) => ({
            ...f,
            accountHolderName: json.account.accountHolderName,
            bankName: json.account.bankName,
            routingCode: json.account.routingCode ?? "",
            accountType: json.account.accountType,
            // Never pre-fill accountNumber — it's masked, not the real value.
            // The seller must re-enter it if they want to save changes.
          }));
        }
      })
      .catch(() => setError("Network error."))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null); setFieldErrors({});
    try {
      const res = await fetch("/api/sellers/bank-account", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrf() },
        body: JSON.stringify({ ...form, routingCode: form.routingCode || null }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.error?.details) setFieldErrors(json.error.details);
        else setError(json.error?.message ?? "Save failed.");
        return;
      }
      setAccount(json.account);
      setForm((f) => ({ ...f, accountNumber: "" })); // clear the field after save
      setSaved(true); setTimeout(() => setSaved(false), 3000);
    } catch { setError("Network error."); }
    finally { setSaving(false); }
  }

  return (
    <SellerLayout>
      <h1 className="font-display text-2xl text-charcoal">Banking</h1>
      <p className="mt-1 text-sm text-muted">
        Add your bank account to receive payouts. Account details are stored encrypted.
      </p>

      {loading && <div className="mt-6 h-64 animate-pulse rounded-sm bg-ivoryDark" />}
      {error && !loading && (
        <p className="mt-4 rounded-sm border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}

      {!loading && (
        <>
          {account && (
            <div className="mt-6 rounded-sm border border-ivoryBorder bg-white p-4 shadow-card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-charcoal">{account.bankName}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {account.accountHolderName} · {account.accountNumber} · {account.accountType}
                  </p>
                </div>
                {account.isVerified ? (
                  <span className="rounded-sm bg-emerald/15 px-2 py-0.5 text-xs font-medium text-emerald">Verified</span>
                ) : (
                  <span className="rounded-sm bg-gold/15 px-2 py-0.5 text-xs font-medium text-gold">Pending verification</span>
                )}
              </div>
              {!account.isVerified && (
                <p className="mt-3 text-xs text-muted">
                  An admin will confirm a test payout reached this account before you can request withdrawals.
                </p>
              )}
            </div>
          )}

          <div className="mt-6">
            <h2 className="mb-4 text-sm font-medium text-charcoal">
              {account ? "Update bank account" : "Add bank account"}
            </h2>
            {account && (
              <p className="mb-4 rounded-sm border border-gold/30 bg-gold/5 p-3 text-xs text-muted">
                Updating your bank account will reset its verification status — an admin will need to re-verify the new account before you can request payouts.
              </p>
            )}
            <form onSubmit={handleSave} className="flex flex-col gap-4 rounded-sm border border-ivoryBorder bg-white p-5 shadow-card">
              {error && saving === false && (
                <p className="text-sm text-red-600">{error}</p>
              )}

              <Field label="Account holder name" error={fieldErrors.accountHolderName}>
                <input value={form.accountHolderName} onChange={(e) => setForm({ ...form, accountHolderName: e.target.value })}
                  placeholder="As it appears on your bank statement" className="input-field" />
              </Field>

              <Field label="Bank name" error={fieldErrors.bankName}>
                <input value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                  placeholder="e.g. Meezan Bank, HBL, UBL" className="input-field" />
              </Field>

              <Field label="Account number" error={fieldErrors.accountNumber}
                hint={account ? "Re-enter your full account number to update (existing number is masked for security)." : undefined}>
                <input value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
                  placeholder={account ? "Re-enter to update" : "Your account number"}
                  className="input-field font-mono" />
              </Field>

              <Field label="IBAN / routing code (optional)" error={fieldErrors.routingCode}>
                <input value={form.routingCode} onChange={(e) => setForm({ ...form, routingCode: e.target.value })}
                  placeholder="IBAN or bank routing code" className="input-field" />
              </Field>

              <Field label="Account type" error={fieldErrors.accountType}>
                <select value={form.accountType} onChange={(e) => setForm({ ...form, accountType: e.target.value as any })}
                  className="input-field">
                  <option value="current">Current</option>
                  <option value="savings">Savings</option>
                </select>
              </Field>

              <div className="flex items-center gap-3 pt-1">
                <button type="submit" disabled={saving}
                  className="rounded-sm bg-charcoal px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-gold disabled:opacity-50">
                  {saving ? "Saving…" : account ? "Update Account" : "Save Account"}
                </button>
                {saved && <p className="text-sm text-emerald">✓ Saved</p>}
              </div>
            </form>
          </div>
        </>
      )}

      <style jsx>{`
        .input-field {
          width: 100%;
          border-radius: 2px;
          border: 1px solid #E8E4DC;
          padding: 10px 14px;
          font-size: 14px;
          color: #1A1A1A;
          outline: none;
          transition: border-color 0.15s;
        }
        .input-field:focus {
          border-color: #B08D57;
          box-shadow: 0 0 0 3px rgba(176,141,87,0.1);
        }
      `}</style>
    </SellerLayout>
  );
}

function Field({ label, children, error, hint }: { label: string; children: React.ReactNode; error?: string; hint?: string }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-charcoal">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-subtle">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-600">{Array.isArray(error) ? error[0] : error}</p>}
    </div>
  );
}
