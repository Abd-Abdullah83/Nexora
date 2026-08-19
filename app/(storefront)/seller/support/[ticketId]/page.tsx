"use client";
// app/(storefront)/seller/support/[ticketId]/page.tsx
// Phase 10 gap fill: individual ticket thread view for the seller.

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { SellerLayout } from "@/components/seller/SellerLayout";

interface Message {
  id: string;
  senderRole: "seller" | "admin";
  body: string;
  createdAt: string;
}

interface Ticket {
  id: string;
  subject: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  assignee: { fullName: string } | null;
  messages: Message[];
}

const STATUS_STYLES: Record<string, string> = {
  open:        "bg-red-50 text-red-700 border border-red-200",
  in_progress: "bg-amber-50 text-amber-700 border border-amber-200",
  resolved:    "bg-emerald-50 text-emerald-700 border border-emerald-200",
  closed:      "bg-gray-100 text-gray-500 border border-gray-200",
};

const PRIORITY_STYLES: Record<string, string> = {
  low:    "text-muted",
  normal: "text-charcoal",
  high:   "text-amber-600 font-medium",
  urgent: "text-red-600 font-semibold",
};

function getCsrf() {
  return document.cookie.split("; ").find((c) => c.startsWith("csrf_token="))?.split("=")[1] ?? "";
}

export default function SellerTicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const ticketId = params.ticketId as string;

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/sellers/support/${ticketId}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error?.message ?? "Could not load ticket.");
        return;
      }
      setTicket(json.ticket);
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [ticketId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [ticket?.messages]);

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim()) return;
    setSending(true);
    setSendError(null);
    try {
      const res = await fetch(`/api/sellers/support/${ticketId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrf() },
        body: JSON.stringify({ body: reply.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSendError(json.error?.message ?? "Failed to send reply.");
        return;
      }
      setReply("");
      await load();
    } catch {
      setSendError("Network error.");
    } finally {
      setSending(false);
    }
  }

  const isClosed = ticket?.status === "resolved" || ticket?.status === "closed";

  return (
    <SellerLayout>
      {/* Breadcrumb */}
      <nav className="mb-4 text-xs text-muted">
        <Link href="/seller/support" className="hover:text-gold transition">Support</Link>
        <span className="mx-2 text-ivoryBorder">/</span>
        <span className="text-charcoal">{ticket?.subject ?? "Loading…"}</span>
      </nav>

      {loading && (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-sm bg-ivoryDark" />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-sm border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
          <button onClick={() => router.push("/seller/support")} className="ml-3 underline">
            Back to tickets
          </button>
        </div>
      )}

      {ticket && !loading && (
        <div className="flex flex-col gap-5">
          {/* Ticket header */}
          <div className="rounded-sm border border-ivoryBorder bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="font-display text-xl text-charcoal">{ticket.subject}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[ticket.status] ?? ""}`}>
                    {ticket.status.replace("_", " ")}
                  </span>
                  <span className={`capitalize ${PRIORITY_STYLES[ticket.priority] ?? "text-muted"}`}>
                    {ticket.priority} priority
                  </span>
                  <span className="text-muted">
                    Opened {new Date(ticket.createdAt).toLocaleDateString()}
                  </span>
                  {ticket.assignee && (
                    <span className="text-muted">
                      Assigned to <span className="text-charcoal">{ticket.assignee.fullName}</span>
                    </span>
                  )}
                  {ticket.resolvedAt && (
                    <span className="text-emerald-600">
                      Resolved {new Date(ticket.resolvedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
              <Link
                href="/seller/support"
                className="rounded-sm border border-ivoryBorder px-3 py-1.5 text-xs text-muted transition hover:text-charcoal"
              >
                ← All tickets
              </Link>
            </div>
          </div>

          {/* Message thread */}
          <div className="flex flex-col gap-3">
            {ticket.messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.senderRole === "seller" ? "justify-end" : "justify-start"}`}
              >
                <div className={`max-w-[80%] rounded-xl px-4 py-3 text-sm ${
                  msg.senderRole === "seller"
                    ? "bg-charcoal text-white rounded-tr-sm"
                    : "bg-white text-charcoal border border-ivoryBorder rounded-tl-sm"
                }`}>
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide opacity-60">
                    {msg.senderRole === "seller" ? "You" : "Support Team"}
                  </div>
                  <p className="leading-relaxed whitespace-pre-wrap">{msg.body}</p>
                  <p className={`mt-1.5 text-[10px] ${msg.senderRole === "seller" ? "text-white/50" : "text-muted"}`}>
                    {new Date(msg.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Reply form */}
          {isClosed ? (
            <div className="rounded-sm border border-ivoryBorder bg-ivory p-4 text-center text-sm text-muted">
              This ticket is {ticket.status}. Open a new ticket if you need further help.
            </div>
          ) : (
            <form onSubmit={handleReply} className="rounded-sm border border-ivoryBorder bg-white p-4">
              <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted">
                Your reply
              </label>
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                rows={4}
                placeholder="Type your reply…"
                className="w-full resize-none rounded-sm border border-ivoryBorder bg-ivory px-3 py-2 text-sm text-charcoal outline-none focus:border-gold"
              />
              {sendError && <p className="mt-1 text-xs text-red-500">{sendError}</p>}
              <div className="mt-3 flex justify-end">
                <button
                  type="submit"
                  disabled={sending || !reply.trim()}
                  className="rounded-sm bg-gold px-5 py-2 text-sm font-semibold text-white transition hover:bg-goldDark disabled:opacity-50"
                >
                  {sending ? "Sending…" : "Send Reply"}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </SellerLayout>
  );
}
