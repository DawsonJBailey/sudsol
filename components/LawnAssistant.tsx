"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Product } from "@/lib/data";
import type { Pest, ControlProduct } from "@/lib/pests";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
  products?: Product[];
  pest?: Pest | null;
  controlProduct?: ControlProduct | null;
};

type PendingImage = { previewUrl: string; base64: string };

const GREETING: ChatMessage = {
  role: "assistant",
  content: "Hi! I can help with lawn care, products, and how-tos. Choose a suggestion or type below.",
};

const SUGGESTIONS = [
  "What grass type fits my climate?",
  "How do I fix brown or thin spots?",
  "Help me plan a fertilizer schedule",
  "Sod vs seed for my yard - what should I pick?",
  "Where can I shop lawn products?",
];

export default function LawnAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [input, setInput] = useState("");
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1] ?? "";
      setPendingImage({ previewUrl: dataUrl, base64 });
    };
    reader.readAsDataURL(file);
  }

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (loading || (!trimmed && !pendingImage)) return;

    const image = pendingImage;

    const userMessage: ChatMessage = {
      role: "user",
      content: trimmed || (image ? "What lawn pest is this?" : ""),
      imageUrl: image?.previewUrl,
    };

    const nextMessages: ChatMessage[] = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setPendingImage(null);
    setLoading(true);

    try {
      const payloadMessages = nextMessages.map((m) => {
        if (m.imageUrl && image && m === userMessage) {
          return {
            role: m.role,
            content: [
              { type: "text", text: m.content },
              { type: "image", mediaType: "image/*", data: image.base64 },
            ],
          };
        }
        return { role: m.role, content: m.content };
      });

      const res = await fetch("/api/lawn-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: payloadMessages }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.error ?? "Something went wrong. Try again in a moment." },
        ]);
        return;
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.reply,
          products: data.products,
          pest: data.pest,
          controlProduct: data.controlProduct,
        },
      ]);
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
                  {m.imageUrl && (
                    <img
                      src={m.imageUrl}
                      alt="Uploaded pest photo"
                      className="max-h-40 rounded-lg mb-2 object-contain"
                    />
                  )}

                  {m.content}

                  {m.pest && (
                    <div className="mt-3 rounded-xl bg-parchment border border-pine/10 px-3 py-2">
                      <p className="font-medium text-pine text-sm">{m.pest.name}</p>
                      <p className="text-xs text-charcoal/60 mt-0.5">{m.pest.damageSigns}</p>
                      {m.controlProduct && (
                        <Link
                          href={`/pest-control/${m.controlProduct.slug}`}
                          className="inline-block mt-2 text-xs font-medium text-gold hover:underline"
                        >
                          View {m.controlProduct.name} →
                        </Link>
                      )}
                    </div>
                  )}

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

            {messages.length === 1 && !loading && (
              <div className="flex flex-col items-center gap-2 pt-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => sendMessage(s)}
                    className="w-full rounded-full border border-pine/15 bg-white/70 px-4 py-2 text-sm text-pine text-center hover:border-gold/50 hover:bg-white transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage(input);
            }}
            className="border-t border-pine/10 bg-white/60 px-3 py-3"
          >
            {pendingImage && (
              <div className="flex items-center gap-2 mb-2">
                <img
                  src={pendingImage.previewUrl}
                  alt="Selected photo preview"
                  className="h-12 w-12 rounded-lg object-cover border border-pine/15"
                />
                <button
                  type="button"
                  onClick={() => setPendingImage(null)}
                  className="text-xs text-charcoal/50 hover:text-clay"
                >
                  Remove photo
                </button>
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
                id="lawn-assistant-photo"
              />
              <label
                htmlFor="lawn-assistant-photo"
                aria-label="Attach a photo"
                className="shrink-0 w-9 h-9 rounded-full border border-pine/15 bg-white flex items-center justify-center cursor-pointer hover:border-gold/50 transition-colors text-lg"
              >
                📷
              </label>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask me for help…"
                disabled={loading}
                className="flex-1 rounded-full border border-pine/15 bg-white px-4 py-2 text-sm text-charcoal placeholder:text-charcoal/40 focus:outline-none focus:border-gold/50 disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={loading || (!input.trim() && !pendingImage)}
                aria-label="Send message"
                className="shrink-0 w-9 h-9 rounded-full bg-gold text-pine-dark flex items-center justify-center hover:bg-gold-light transition-colors disabled:opacity-40"
              >
                ➤
              </button>
            </div>
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
