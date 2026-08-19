"use client";

import { useEffect, useState, useCallback } from "react";
import { SellerLayout } from "@/components/seller/SellerLayout";

interface Thread {
  id: string;
  orderId: string;
  sellerUnread: number;
  updatedAt: string;
  buyer: { fullName: string; email: string };
  order: { orderNumber: string };
  messages: { body: string; senderRole: string; createdAt: string }[];
}

interface Message {
  id: string;
  senderRole: string;
  body: string;
  createdAt: string;
}

function getCsrf(): string {
  return document.cookie.split("; ").find((c) => c.startsWith("csrf_token="))?.split("=")[1] ?? "";
}

export default function SellerMessagesPage() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const loadInbox = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sellers/messages?page=${page}&pageSize=20`);
      const json = await res.json();
      setThreads(json.threads ?? []);
      setTotalPages(json.totalPages ?? 1);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { loadInbox(); }, [loadInbox]);

  async function openThread(thread: Thread) {
    setSelected(thread);
    setLoadingThread(true);
    setError(null);
    try {
      const res = await fetch(`/api/sellers/messages/${thread.id}`);
      const json = await res.json();
      setMessages(json.messages ?? []);
      // Mark as read — refresh inbox to clear badge
      loadInbox();
    } finally {
      setLoadingThread(false);
    }
  }

  async function sendReply() {
    if (!reply.trim() || !selected) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/sellers/messages/${selected.id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrf() },
        body: JSON.stringify({ body: reply.trim() }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error?.message ?? "Failed to send."); return; }
      setMessages((prev) => [...prev, json.message]);
      setReply("");
    } finally {
      setSending(false);
    }
  }

  return (
    <SellerLayout>
      <h1 className="mb-1 font-display text-2xl text-charcoal">Messages</h1>
      <p className="mb-6 text-sm text-muted">Buyer messages about their orders.</p>

      <div className="flex gap-4" style={{ height: "calc(100vh - 180px)" }}>
        {/* Thread list */}
        <div className="flex w-72 flex-shrink-0 flex-col overflow-hidden rounded-sm border border-ivoryBorder bg-white">
          <div className="border-b border-ivoryBorder px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted">
            Inbox
          </div>
          {loading ? (
            <p className="p-4 text-sm text-muted">Loading…</p>
          ) : threads.length === 0 ? (
            <p className="p-4 text-sm text-muted">No messages yet.</p>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {threads.map((t) => (
                <button
                  key={t.id}
                  onClick={() => openThread(t)}
                  className={`w-full border-b border-ivoryBorder px-4 py-3 text-left transition hover:bg-ivoryDark ${selected?.id === t.id ? "bg-gold/10" : ""
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-charcoal truncate">{t.buyer.fullName}</p>
                    {t.sellerUnread > 0 && (
                      <span className="ml-2 flex-shrink-0 rounded-full bg-gold px-1.5 py-0.5 text-[10px] font-bold text-white">
                        {t.sellerUnread}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted truncate">Order {t.order.orderNumber}</p>
                  {t.messages[0] && (
                    <p className="mt-1 text-xs text-subtle truncate">{t.messages[0].body}</p>
                  )}
                </button>
              ))}
            </div>
          )}
          {totalPages > 1 && (
            <div className="flex justify-between border-t border-ivoryBorder px-3 py-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="text-xs text-muted disabled:opacity-40">Prev</button>
              <span className="text-xs text-muted">{page}/{totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="text-xs text-muted disabled:opacity-40">Next</button>
            </div>
          )}
        </div>

        {/* Thread messages */}
        <div className="flex flex-1 flex-col overflow-hidden rounded-sm border border-ivoryBorder bg-white">
          {!selected ? (
            <div className="flex flex-1 items-center justify-center text-sm text-muted">
              Select a conversation to view messages.
            </div>
          ) : loadingThread ? (
            <div className="flex flex-1 items-center justify-center text-sm text-muted">Loading…</div>
          ) : (
            <>
              <div className="border-b border-ivoryBorder px-5 py-3">
                <p className="font-medium text-charcoal">{selected.buyer.fullName}</p>
                <p className="text-xs text-muted">Order {selected.order.orderNumber}</p>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.senderRole === "seller" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[75%] rounded-xl px-4 py-2.5 text-sm ${msg.senderRole === "seller"
                      ? "bg-charcoal text-white rounded-tr-sm"
                      : "bg-ivory text-charcoal border border-ivoryBorder rounded-tl-sm"
                      }`}>
                      <p>{msg.body}</p>
                      <p className={`mt-1 text-[10px] ${msg.senderRole === "seller" ? "text-white/50" : "text-muted"}`}>
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-ivoryBorder p-4">
                {error && <p className="mb-2 text-xs text-red-500">{error}</p>}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendReply()}
                    placeholder="Type a reply…"
                    className="flex-1 rounded-sm border border-ivoryBorder bg-ivory px-3 py-2 text-sm text-charcoal outline-none focus:border-gold"
                  />
                  <button
                    onClick={sendReply}
                    disabled={sending || !reply.trim()}
                    className="rounded-sm bg-gold px-4 py-2 text-sm font-medium text-white transition hover:bg-goldDark disabled:opacity-50"
                  >
                    {sending ? "…" : "Send"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </SellerLayout>
  );
}
