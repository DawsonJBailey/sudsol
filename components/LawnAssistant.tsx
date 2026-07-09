"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Product } from "@/lib/data";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  products?: Product[];
};

const GREETING: ChatMessage = {
  role: "assistant",
  content:
    "Hi! I can help you find the right sod, seed, or plugs. Tell me about your yard — sun or shade, how much traffic it gets, whether you want low maintenance or the best possible look, and if you're starting a new lawn or filling in bare spots.",
};

export default function LawnAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/lawn-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.error ?? "Something went wrong. Try again in a moment." },
        ]);
        return;
      }

      setMessages((prev) => [...prev, { role: "assistant", content: data.reply, products: data.products }]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Couldn't reach the assistant. Try again in a moment." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {open && (
        <div className="mb-3 w-[min(23rem,calc(100vw-2.5rem))] h-[min(32rem,calc(100vh-8rem))] flex flex-col rounded-2xl bg-parchment border border-pine/15 shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between bg-pine text-parchment px-4 py-3">
            <span className="font-display text-lg">Lawn Care Assistant</span>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              className="text-parchment/80 hover:text-parchment text-xl leading-none px-1"
            >
              ×
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={
                    m.role === "user"
                      ? "max-w-[85%] rounded-2xl rounded-br-sm bg-pine text-parchment px-3.5 py-2.5 text-sm"
                      : "max-w-[90%] rounded-2xl rounded-bl-sm bg-white/70 border border-pine/10 text-charcoal px-3.5 py-2.5 text-sm whitespace-pre-line"
                  }
                >
                  {m.content}

                  {m.products && m.products.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {m.products.map((p) => (
                        <Link
                          key={p.slug}
                          href={`/product/${p.slug}`}
                          className="block rounded-xl bg-parchment border border-pine/10 px-3 py-2 hover:border-gold/50 transition-colors"
                        >
                          <p className="font-medium text-pine text-sm">{p.name}</p>
                          <p className="text-xs text-charcoal/60 mt-0.5">{p.tagline}</p>
                          <p className="text-xs font-semibold text-charcoal mt-1">
                            From ${p.priceFrom.toFixed(2)}
                          </p>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-sm bg-white/70 border border-pine/10 text-charcoal/50 px-3.5 py-2.5 text-sm">
                  Thinking…
                </div>
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage(input);
            }}
            className="flex items-center gap-2 border-t border-pine/10 bg-white/60 px-3 py-3"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask me for help…"
              disabled={loading}
              className="flex-1 rounded-full border border-pine/15 bg-white px-4 py-2 text-sm text-charcoal placeholder:text-charcoal/40 focus:outline-none focus:border-gold/50 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              aria-label="Send message"
              className="shrink-0 w-9 h-9 rounded-full bg-gold text-pine-dark flex items-center justify-center hover:bg-gold-light transition-colors disabled:opacity-40"
            >
              ➤
            </button>
          </form>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close lawn care assistant" : "Open lawn care assistant"}
        className="w-14 h-14 rounded-full bg-pine text-parchment shadow-xl flex items-center justify-center hover:bg-pine-dark transition-colors text-2xl"
      >
        {open ? "×" : "💬"}
      </button>
    </div>
  );
}
