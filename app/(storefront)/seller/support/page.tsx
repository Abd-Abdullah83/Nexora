"use client";
// app/(storefront)/seller/support/page.tsx
// Phase 10 gap fill: Seller Support Center — ticket list + create.

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { SellerLayout } from "@/components/seller/SellerLayout";

interface TicketSummary {
  id: string; subject: string; status: string; priority: string;
  createdAt: string; updatedAt: string;
  messages: { body: string; senderRole: string; createdAt: string }[];
}

const STATUS_STYLES: Record<string, string> = {
  open:        "bg-red-50 text-red-700 border-red-200",
  in_progress: "bg-amber-50 text-amber-700 border-amber-200",
  resolved:    "bg-emerald-50 text-emerald-700 border-emerald-200",
  closed:      "bg-gray-100 text-gray-500 border-gray-200",
};

function getCsrf() {
  return document.cookie.split("; ").find((c) => c.startsWith("csrf_token="))?.split("=")[1] ?? "";
}

function NewTicketForm({ onCreated }: { onCreated: () => void }) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError(null); setSaving(true);
    try {
      const res = await fetch("/api/sellers/support", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrf() },
        body: JSON.stringify({ subject, body }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error?.message ?? "Could not create ticket."); return; }
      setSubject(""); setBody("");
      onCreated();
    } catch { setError("Network error."); }
    finally { setSaving(false); }
  }

  return (
    <form onSubmit={submit} className="rounded-sm border border-ivoryBorder bg-white p-5 shadow-card mb-6">
      <h2 className="mb-4 font-display text-base text-charcoal">Open a support ticket</h2>
      <div className="mb-3">
        <label className="mb-1 block text-xs font-medium text-charcoal">Subject</label>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} required minLength={5} maxLength={200}
          placeholder="e.g. Question about commission rates"
          className="w-full rounded-sm border border-ivoryBorder px-3 py-2 text-sm text-charcoal focus:border-gold focus:outline-none" />
      </div>
      <div className="mb-3">
        <label className="mb-1 block text-xs font-medium text-charcoal">Message</label>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} required minLength={10} rows={4}
          placeholder="Describe your issue or question..."
          className="w-full resize-none rounded-sm border border-ivoryBorder px-3 py-2 text-sm text-charcoal focus:border-gold focus:outline-none" />
      </div>
      {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
      <button type="submit" disabled={saving}
        className="rounded-sm bg-charcoal px-5 py-2 text-sm font-semibold text-white transition hover:bg-gold disabled:opacity-50">
        {saving ? "Submitting…" : "Submit ticket"}
      </button>
    </form>
  );
}

export default function SellerSupportPage() {
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [page, setPage]       = useState(1);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/sellers/support?page=${page}&pageSize=20`);
      const json = await res.json();
      if (!res.ok) { setError(json.error?.message ?? "Could not load tickets."); return; }
      setTickets(json.items ?? []); setTotal(json.total ?? 0);
    } catch { setError("Network error."); }
    finally { setLoading(false); }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / 20));

  return (
    <SellerLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl text-charcoal">Support</h1>
          <p className="mt-1 text-sm text-muted">{total} ticket{total !== 1 ? "s" : ""}</p>
        </div>
        <button onClick={() => setShowForm((v) => !v)}
          className="rounded-sm bg-gold px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-goldDark">
          {showForm ? "Cancel" : "+ New Ticket"}
        </button>
      </div>

      {showForm && <NewTicketForm onCreated={() => { setShowForm(false); load(); }} />}

      {error && <p className="mb-4 rounded-sm border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {loading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-sm bg-ivoryDark" />
        ))}</div>
      ) : tickets.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm text-muted">No support tickets yet.</p>
          <button onClick={() => setShowForm(true)}
            className="mt-4 rounded-sm bg-gold px-5 py-2 text-sm font-semibold text-white transition hover:bg-goldDark">
            Open your first ticket
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => {
            const lastMsg = t.messages[0];
            return (
              <Link key={t.id} href={`/seller/support/${t.id}`}
                className="block rounded-sm border border-ivoryBorder bg-white p-4 shadow-card transition hover:border-gold/40">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className={`rounded-sm border px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[t.status] ?? ""}`}>
                        {t.status.replace("_", " ")}
                      </span>
                      <span className={`text-xs capitalize ${t.priority === "urgent" ? "text-red-600 font-medium" : "text-muted"}`}>
                        {t.priority}
                      </span>
                    </div>
                    <p className="font-medium text-charcoal truncate">{t.subject}</p>
                    {lastMsg && (
                      <p className="mt-1 text-xs text-muted truncate">
                        <span className="capitalize">{lastMsg.senderRole}</span>: {lastMsg.body}
                      </p>
                    )}
                  </div>
                  <p className="text-xs text-subtle whitespace-nowrap">
                    {new Date(t.updatedAt).toLocaleDateString()}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
            className="rounded-sm border border-ivoryBorder px-3 py-1.5 text-xs text-muted disabled:opacity-40 hover:text-charcoal">← Prev</button>
          <span className="text-xs text-muted">Page {page} of {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="rounded-sm border border-ivoryBorder px-3 py-1.5 text-xs text-muted disabled:opacity-40 hover:text-charcoal">Next →</button>
        </div>
      )}
    </SellerLayout>
  );
}
