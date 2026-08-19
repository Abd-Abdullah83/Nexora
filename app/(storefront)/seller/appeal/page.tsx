"use client";

// app/(storefront)/seller/appeal/page.tsx
//
// DELIBERATELY does NOT use <SellerLayout> — that component's sidebar
// fetches several endpoints (orders, disputes, messages, notifications)
// that all independently check seller.status === "active" and will error
// out for a banned/suspended seller. This page needs to render cleanly
// specifically for the sellers who are NOT active, so it's a minimal,
// self-contained wrapper instead.

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";

interface AppealMessage {
  id: string;
  senderRole: "system" | "seller" | "admin";
  body: string;
  createdAt: string;
}

interface Appeal {
  id: string;
  status: "open" | "seller_replied" | "admin_replied" | "resolved_upheld" | "resolved_lifted";
  createdAt: string;
  messages: AppealMessage[];
}

const STATUS_LABELS: Record<string, string> = {
  open: "Awaiting your response",
  seller_replied: "Sent — awaiting admin review",
  admin_replied: "Admin has replied",
  resolved_upheld: "Resolved — decision upheld",
  resolved_lifted: "Resolved — account reinstated",
};

function getCsrf() {
  return document.cookie.split("; ").find((c) => c.startsWith("csrf_token="))?.split("=")[1] ?? "";
}

export default function SellerAppealPage() {
  const [appeal, setAppeal] = useState<Appeal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/sellers/appeal");
      const json = await res.json();
      if (!res.ok) {
        setError(json.error?.message ?? "Could not load your appeal.");
        return;
      }
      setAppeal(json.appeal);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [appeal?.messages.length]);

  async function send() {
    if (!body.trim()) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/sellers/appeal", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrf() },
        body: JSON.stringify({ body: body.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error?.message ?? "Could not send message.");
        return;
      }
      setBody("");
      await load();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSending(false);
    }
  }

  const resolved = appeal?.status === "resolved_upheld" || appeal?.status === "resolved_lifted";

  return (
    <div className="min-h-screen bg-ivory">
      <div className="border-b border-ivoryBorder bg-white">
        <div className="mx-auto max-w-2xl px-4 py-4">
          <Link href="/" className="font-display text-sm tracking-widest text-charcoal uppercase">
            Nexora
          </Link>
        </div>
      </div>

      <main className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="font-display text-2xl text-charcoal">Account Appeal</h1>
        <p className="mt-1 text-sm text-muted">
          Message our team directly about your account status. We typically respond within 1–2 business days.
        </p>

        {loading ? (
          <div className="mt-8 h-64 animate-pulse rounded-sm bg-ivoryDark" />
        ) : error && !appeal ? (
          <p className="mt-6 rounded-sm border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>
        ) : !appeal ? (
          <div className="mt-8 rounded-sm border border-ivoryBorder bg-white p-6 text-center">
            <p className="text-sm text-muted">
              No appeal thread found. Appeals are opened automatically if an enforcement action
              is taken on your account.
            </p>
          </div>
        ) : (
          <>
            <div className="mt-6 flex items-center justify-between rounded-sm border border-ivoryBorder bg-white px-4 py-3">
              <span className="text-sm font-medium text-charcoal">
                {STATUS_LABELS[appeal.status]}
              </span>
              <span className="text-xs text-subtle">
                Opened {new Date(appeal.createdAt).toLocaleDateString()}
              </span>
            </div>

            {/* Message thread */}
            <div className="mt-4 flex flex-col gap-3 rounded-sm border border-ivoryBorder bg-white p-5 max-h-[50vh] overflow-y-auto">
              {appeal.messages.map((msg) => {
                const isSeller = msg.senderRole === "seller";
                const isSystem = msg.senderRole === "system";
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isSeller ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-sm px-4 py-3 text-sm whitespace-pre-line ${
                        isSystem
                          ? "border border-amber-200 bg-amber-50 text-amber-900 w-full"
                          : isSeller
                          ? "bg-gold text-white"
                          : "border border-ivoryBorder bg-ivory text-charcoal"
                      }`}
                    >
                      {!isSystem && (
                        <p className={`mb-1 text-[10px] uppercase tracking-wide ${isSeller ? "text-white/70" : "text-subtle"}`}>
                          {isSeller ? "You" : "Nexora Admin"}
                        </p>
                      )}
                      {isSystem && (
                        <p className="mb-1 text-[10px] uppercase tracking-wide text-amber-700">
                          System notice
                        </p>
                      )}
                      {msg.body}
                      <p className={`mt-1.5 text-[10px] ${isSeller ? "text-white/60" : "text-subtle"}`}>
                        {new Date(msg.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {/* Reply box */}
            {resolved ? (
              <div className="mt-4 rounded-sm border border-ivoryBorder bg-ivory p-4 text-center text-sm text-muted">
                This appeal has been resolved and is now closed.
              </div>
            ) : (
              <div className="mt-4">
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={3}
                  placeholder="Explain your side or ask a question…"
                  className="w-full resize-none rounded-sm border border-ivoryBorder bg-white px-3 py-2.5 text-sm text-charcoal outline-none focus:border-gold"
                />
                {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
                <button
                  onClick={send}
                  disabled={sending || !body.trim()}
                  className="mt-2 rounded-sm bg-gold px-5 py-2 text-sm font-semibold text-white transition hover:bg-goldDark disabled:opacity-50"
                >
                  {sending ? "Sending…" : "Send"}
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
