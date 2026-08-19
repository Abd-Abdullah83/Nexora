"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { SellerLayout } from "@/components/seller/SellerLayout";

interface Message {
  id: string;
  senderRole: "buyer" | "seller";
  senderId: string;
  body: string;
  createdAt: string;
}

interface Thread {
  id: string;
  orderId: string;
  orderNumber: string;
  buyerName: string;
  storeName: string;
  messages: Message[];
  viewerRole: "buyer" | "seller";
}

function getCsrf(): string {
  return (
    document.cookie
      .split("; ")
      .find((c) => c.startsWith("csrf_token="))
      ?.split("=")[1] ?? ""
  );
}

export default function SellerMessageThreadPage() {
  const params = useParams<{ threadId: string }>();
  const router = useRouter();
  const bottomRef = useRef<HTMLDivElement>(null);

  const [thread, setThread] = useState<Thread | null>(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/sellers/messages/${params.threadId}`)
      .then((r) => r.json())
      .then((data) => setThread(data.thread ?? null))
      .finally(() => setLoading(false));
  }, [params.threadId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread?.messages]);

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim() || sending) return;
    setSending(true);
    setError(null);

    try {
      const res = await fetch(`/api/sellers/messages/${params.threadId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": getCsrf(),
        },
        body: JSON.stringify({ body: reply }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? "Failed to send.");
        return;
      }
      setThread((prev) =>
        prev
          ? { ...prev, messages: [...prev.messages, data.message] }
          : prev
      );
      setReply("");
    } catch {
      setError("Network error.");
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <SellerLayout>
        <p className="text-sm text-muted">Loading…</p>
      </SellerLayout>
    );
  }

  if (!thread) {
    return (
      <SellerLayout>
        <div className="rounded-sm border border-ivoryBorder bg-white p-10 text-center">
          <p className="text-sm text-muted">Thread not found.</p>
          <button
            onClick={() => router.push("/seller/messages")}
            className="mt-3 text-sm text-gold hover:underline"
          >
            ← Back to messages
          </button>
        </div>
      </SellerLayout>
    );
  }

  return (
    <SellerLayout>
      {/* Header */}
      <div className="mb-4 flex items-center gap-4">
        <button
          onClick={() => router.push("/seller/messages")}
          className="text-sm text-muted hover:text-charcoal"
        >
          ←
        </button>
        <div>
          <h1 className="font-display text-xl text-charcoal">
            {thread.buyerName}
          </h1>
          <p className="text-xs text-muted">Order {thread.orderNumber}</p>
        </div>
      </div>

      {/* Messages */}
      <div
        className="mb-4 flex flex-col gap-3 overflow-y-auto rounded-sm border border-ivoryBorder bg-white p-4"
        style={{ minHeight: "400px", maxHeight: "60vh" }}
      >
        {thread.messages.length === 0 ? (
          <p className="text-sm text-muted text-center mt-8">
            No messages yet. Start the conversation.
          </p>
        ) : (
          thread.messages.map((msg) => {
            const isMine = msg.senderRole === thread.viewerRole;
            return (
              <div
                key={msg.id}
                className={`flex ${isMine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                    isMine
                      ? "bg-charcoal text-white rounded-tr-sm"
                      : "bg-ivory text-charcoal border border-ivoryBorder rounded-tl-sm"
                  }`}
                >
                  <p>{msg.body}</p>
                  <p
                    className={`mt-1 text-[10px] ${
                      isMine ? "text-white/50" : "text-muted"
                    }`}
                  >
                    {new Date(msg.createdAt).toLocaleTimeString("en-PK", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Reply form */}
      <form onSubmit={sendReply} className="flex gap-3">
        <input
          type="text"
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder="Type a reply…"
          className="flex-1 rounded-sm border border-ivoryBorder bg-white px-4 py-2.5 text-sm text-charcoal outline-none focus:border-gold"
        />
        <button
          type="submit"
          disabled={!reply.trim() || sending}
          className="rounded-sm bg-gold px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-goldDark disabled:opacity-50"
        >
          {sending ? "…" : "Send"}
        </button>
      </form>
      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
    </SellerLayout>
  );
}
