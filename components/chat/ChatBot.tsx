"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "@/hooks/useSession";

interface Message {
  role: "user" | "model";
  text: string;
  timestamp: Date;
}

function getCsrf(): string {
  return (
    document.cookie
      .split("; ")
      .find((c) => c.startsWith("csrf_token="))
      ?.split("=")[1] ?? ""
  );
}

// Simple markdown-like renderer for bold and links
function RenderText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|\/product\/[^\s)]+)/g);
  return (
    <span>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith("*") && part.endsWith("*")) {
          return <em key={i}>{part.slice(1, -1)}</em>;
        }
        if (part.startsWith("/product/")) {
          return (
            <a key={i} href={part} className="text-gold underline hover:text-goldDark" target="_blank" rel="noreferrer">
              View product
            </a>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}

const BUYER_QUICK_STARTERS = [
  "Show me featured products",
  "What categories do you have?",
  "I need a gift under PKR 3,000",
  "Best skin care products",
];

const SELLER_QUICK_STARTERS = [
  "How do I add a new listing?",
  "Why was my listing flagged?",
  "How does the escrow release work?",
  "How do I request a payout?",
];

function initialMessageFor(mode: "buyer" | "seller"): Message {
  return {
    role: "model",
    text:
      mode === "seller"
        ? "Hi! I'm **Nex**, here to help with your Seller Central account 👋\n\nI can answer questions about listings, orders, payouts, policies, and account rules. How can I help?"
        : "Hi! I'm **Nex**, your Nexora shopping assistant 👋\n\nI can help you find products, get recommendations, or answer questions about your order. How can I help you today?",
    timestamp: new Date(),
  };
}

/**
 * Chat history is scoped per logged-in user (and separately for guests),
 * never a single shared key — this is what keeps User A's conversation
 * from ever appearing for User B on a shared browser/tab. Guests get
 * their own transient key that isn't tied to any account.
 */
function storageKeyFor(userId: string | null): string {
  return userId ? `nexora_chat:${userId}` : "nexora_chat:guest";
}

function loadSessionMessages(key: string, mode: "buyer" | "seller"): Message[] {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return [initialMessageFor(mode)];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return [initialMessageFor(mode)];
    return parsed.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }));
  } catch {
    return [initialMessageFor(mode)];
  }
}

export function ChatBot() {
  const pathname = usePathname();
  const { user, isLoading: sessionLoading } = useSession();

  // Sellers get a slightly different assistant scope (account/listing/
  // policy help) — anyone NOT a seller (including guests) gets the
  // regular shopping assistant.
  const mode: "buyer" | "seller" =
    user?.role === "seller_individual" || user?.role === "seller_business" ? "seller" : "buyer";

  const storageKey = storageKeyFor(user?.id ?? null);

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window !== "undefined") return loadSessionMessages(storageKeyFor(null), "buyer");
    return [initialMessageFor("buyer")];
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>(BUYER_QUICK_STARTERS);
  const [unread, setUnread] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reload the correct conversation whenever the identified user (or mode)
  // changes — this fires once session data resolves after mount, and
  // again any time the logged-in user changes (login/logout/switch
  // account in the same tab). This is what actually enforces isolation:
  // switching users swaps in that user's own history instead of
  // continuing to show whatever was loaded at first render.
  useEffect(() => {
    if (sessionLoading) return;
    setMessages(loadSessionMessages(storageKey, mode));
    setSuggestions(mode === "seller" ? SELLER_QUICK_STARTERS : BUYER_QUICK_STARTERS);
  }, [storageKey, mode, sessionLoading]);

  // Persist conversation under this user's own key
  useEffect(() => {
    if (sessionLoading) return;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(messages));
    } catch { /* quota exceeded — non-fatal */ }
  }, [messages, storageKey, sessionLoading]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setUnread(0);
    }
  }, [open]);

  function toGeminiHistory() {
    return messages.map((m) => ({
      role: m.role,
      parts: [{ text: m.text }],
    }));
  }

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;

    const userMsg: Message = { role: "user", text, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSuggestions([]);
    setLoading(true);

    try {
      const history = toGeminiHistory();
      history.push({ role: "user", parts: [{ text }] });

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": getCsrf(),
        },
        // mode tells the API which system prompt/scope to use — the
        // server never trusts this alone for anything security-sensitive,
        // it only ever changes which topics Nex is willing to discuss.
        body: JSON.stringify({ messages: history, mode }),
      });

      const data = await res.json();

      const replyText = res.ok
        ? data.reply
        : data.error ?? "Sorry, I couldn't get a response. You can also reach our support team via [WhatsApp](/contact) or email us at support@nexora.pk.";

      const aiMsg: Message = {
        role: "model",
        text: replyText,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMsg]);

      if (data.suggestions?.length) {
        setSuggestions(data.suggestions);
      }

      if (!open) setUnread((n) => n + 1);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "model",
          text: "Network error. Please check your connection and try again, or contact us at support@nexora.pk.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  function formatTime(date: Date) {
    return date.toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" });
  }

  /** Fully wipes this user's conversation, both in memory and in storage. */
  function clearChat() {
    const fresh = [initialMessageFor(mode)];
    setMessages(fresh);
    setSuggestions(mode === "seller" ? SELLER_QUICK_STARTERS : BUYER_QUICK_STARTERS);
    try {
      sessionStorage.removeItem(storageKey);
    } catch { /* non-fatal */ }
  }

  const hiddenPrefixes = ["/admin", "/login", "/register", "/forgot-password", "/reset-password", "/verify-email"];
  if (hiddenPrefixes.some((p) => pathname?.startsWith(p))) {
    return null;
  }

  return (
    <>
      {/* ── Floating button ── */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setOpen((o) => !o)}
          className="relative flex h-14 w-14 items-center justify-center rounded-full bg-charcoal text-white shadow-lg transition hover:bg-gold active:scale-95"
          aria-label="Open chat assistant"
        >
          {open ? (
            <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
            </svg>
          )}
          {unread > 0 && !open && (
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
              {unread}
            </span>
          )}
        </button>
      </div>

      {/* ── Chat window ── */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 flex w-80 flex-col overflow-hidden rounded-xl border border-ivoryBorder bg-white shadow-dropdown sm:w-96"
          style={{ height: "520px" }}>

          {/* Header */}
          <div className="flex items-center gap-3 bg-charcoal px-4 py-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gold text-sm font-bold text-white">
              N
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-white">
                Nex {mode === "seller" ? "— Seller Support" : "— Shopping Assistant"}
              </p>
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs text-white/60">Online · Powered by Gemini</span>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="text-white/50 hover:text-white transition">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] ${msg.role === "user" ? "" : "flex items-start gap-2"}`}>
                  {msg.role === "model" && (
                    <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gold text-[10px] font-bold text-white mt-0.5">
                      N
                    </div>
                  )}
                  <div>
                    <div
                      className={`rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                        msg.role === "user"
                          ? "bg-charcoal text-white rounded-tr-sm"
                          : "bg-ivory text-charcoal rounded-tl-sm border border-ivoryBorder"
                      }`}
                    >
                      <RenderText text={msg.text} />
                    </div>
                    <p className={`mt-0.5 text-[10px] text-muted ${msg.role === "user" ? "text-right" : ""}`}>
                      {formatTime(msg.timestamp)}
                    </p>
                  </div>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gold text-[10px] font-bold text-white">N</div>
                  <div className="rounded-2xl rounded-tl-sm border border-ivoryBorder bg-ivory px-4 py-3">
                    <div className="flex gap-1">
                      <span className="h-2 w-2 rounded-full bg-muted animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="h-2 w-2 rounded-full bg-muted animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="h-2 w-2 rounded-full bg-muted animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Quick suggestions */}
          {suggestions.length > 0 && !loading && (
            <div className="flex gap-2 overflow-x-auto px-4 py-2 hide-scrollbar">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="flex-shrink-0 rounded-full border border-ivoryBorder bg-ivory px-3 py-1 text-xs text-charcoal transition hover:border-gold hover:text-gold"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="border-t border-ivoryBorder bg-white px-3 py-3">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={mode === "seller" ? "Ask about your account, listings, payouts..." : "Ask about products..."}
                disabled={loading}
                className="flex-1 rounded-full border border-ivoryBorder bg-ivory px-4 py-2 text-sm text-charcoal outline-none transition placeholder:text-subtle focus:border-gold disabled:opacity-50"
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || loading}
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gold text-white transition hover:bg-goldDark disabled:opacity-40"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              </button>
            </div>
            <p className="mt-1.5 text-center text-[10px] text-subtle">
              Powered by Gemini · <a href="/contact" className="hover:text-gold transition">Contact support</a> ·{" "}
              <button onClick={clearChat} className="hover:text-gold transition">Clear chat</button>
            </p>
          </div>
        </div>
      )}
    </>
  );
}
