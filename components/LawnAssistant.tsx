"use client";

import { useEffect, useRef, useState } from "react";
import { fileToVisionJpeg } from "@/lib/image-client";
import {
  ALL_PREFERENCE_QUESTIONS,
  type PreferenceQuestion,
} from "@/lib/preferences";
import ChatProductCard from "./ChatProductCard";

// Products/treatments the API returns to the client carry the Shopify variant id
// and image the Add to Cart cards need — richer than the base Product type.
type ChatProduct = {
  slug: string;
  name: string;
  tagline: string;
  priceFrom: number;
  image: { src: string; alt: string };
  variantId: string;
};

type ChatControlProduct = {
  slug: string;
  name: string;
  price: number;
  description: string;
  image: { src: string; alt: string };
  variantId: string;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
  products?: ChatProduct[];
  questions?: PreferenceQuestion[];
  // Treatment cards for every pest identified this turn (deduped server-side).
  controlProducts?: ChatControlProduct[];
};

type PendingImage = { previewUrl: string; base64: string };

const GREETING: ChatMessage = {
  role: "assistant",
  content:
    "Hi! I can help with lawn care, products, and how-tos. Choose a suggestion or type below.",
};

// Chips with a `questions` set are unambiguous "help me pick a product"
// intents, where the bot always responds with the same fixed questions.
// Rendering those buttons locally makes them appear instantly and skips two
// Anthropic round-trips. Ambiguous chips still go to the model.
const SUGGESTIONS: { label: string; questions?: PreferenceQuestion[] }[] = [
  {
    label: "What grass type fits my climate?",
    questions: ALL_PREFERENCE_QUESTIONS,
  },
  // { label: "How do I fix brown or thin spots?" },
  // { label: "Help me plan a fertilizer schedule" },
  {
    label: "Sod vs seed for my yard - what should I pick?",
    questions: ALL_PREFERENCE_QUESTIONS,
  },
  // { label: "Where can I shop lawn products?" },
];

const PREFERENCES_LEAD_IN =
  "Happy to help you find the right fit! A few quick questions — tap whichever apply:";

// Pest identification is handled locally rather than as an API call: clicking it
// just prompts the visitor for a photo, which they then attach via the 📷 button.
const PEST_ID_LABEL = "Pest Identification";
const PEST_ID_REPLY =
  "Happy to help identify it. Tap the 📷 button below and upload a clear photo of either the bug itself or the affected patch of lawn, and I'll take a look.";

export default function LawnAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [input, setInput] = useState("");
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  // Tapped answers for the latest bot question set, keyed by question key.
  const [selectedAnswers, setSelectedAnswers] = useState<
    Record<string, string>
  >({});
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    try {
      // Re-encode to a clean JPEG so any browser-viewable format works.
      const { dataUrl, base64 } = await fileToVisionJpeg(file);
      setPendingImage({ previewUrl: dataUrl, base64 });
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            err instanceof Error
              ? err.message
              : "I couldn't read that image. Try a different photo.",
        },
      ]);
    }
  }

  // Compose the tapped answers into a plain-text visitor reply (the model
  // handles it exactly like a typed sentence) and send it.
  function sendSelectedAnswers(
    questions: PreferenceQuestion[],
    answers: Record<string, string>,
  ) {
    const parts = questions.flatMap((q) =>
      answers[q.key] ? [answers[q.key]] : [],
    );
    if (parts.length === 0) return;
    setSelectedAnswers({});
    sendMessage(parts.join(". ") + ".");
  }

  function handleSelectOption(
    questions: PreferenceQuestion[],
    questionKey: string,
    value: string,
  ) {
    if (loading) return;
    const next = { ...selectedAnswers, [questionKey]: value };
    setSelectedAnswers(next);
    // Auto-send the moment every question has an answer — no extra click.
    if (questions.every((q) => next[q.key])) {
      sendSelectedAnswers(questions, next);
    }
  }

  // Show the preference questions immediately, with no API call — the bot's
  // response to these chips is always the same fixed question set.
  function startPreferenceFlow(label: string, questions: PreferenceQuestion[]) {
    if (loading) return;
    setMessages((prev) => [
      ...prev,
      { role: "user", content: label },
      {
        role: "assistant",
        content: PREFERENCES_LEAD_IN,
        questions,
      },
    ]);
    setInput("");
    setSelectedAnswers({});
  }

  // Reset the conversation to its initial state (greeting + suggestions).
  function startNewChat() {
    if (loading) return;
    setMessages([GREETING]);
    setInput("");
    setPendingImage(null);
    setSelectedAnswers({});
  }

  function startPestIdentification() {
    if (loading) return;
    setMessages((prev) => [
      ...prev,
      { role: "user", content: PEST_ID_LABEL },
      { role: "assistant", content: PEST_ID_REPLY },
    ]);
    setInput("");
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
          {
            role: "assistant",
            content:
              data.error ?? "Something went wrong. Try again in a moment.",
          },
        ]);
        return;
      }

      setSelectedAnswers({});
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.reply,
          products: data.products,
          questions: data.questions,
          controlProducts: data.controlProducts,
        },
      ]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Couldn't reach the assistant. Try again in a moment.",
        },
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
            <div className="flex items-center gap-2">
              <button
                onClick={startNewChat}
                disabled={loading}
                aria-label="Start a new chat"
                className="rounded-full border border-parchment/30 text-parchment/90 text-xs font-medium px-2.5 py-1 hover:bg-parchment/10 hover:text-parchment transition-colors disabled:opacity-50"
              >
                New chat
              </button>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close chat"
                className="text-parchment/80 hover:text-parchment text-xl leading-none px-1"
              >
                ×
              </button>
            </div>
          </div>

          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
          >
            {messages.map((m, i) => (
              <div
                key={i}
                className={
                  m.role === "user" ? "flex justify-end" : "flex justify-start"
                }
              >
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

                  {m.controlProducts && m.controlProducts.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {m.controlProducts.map((cp) => (
                        <ChatProductCard
                          key={cp.slug}
                          slug={cp.slug}
                          name={cp.name}
                          subtitle={cp.description}
                          price={cp.price}
                          priceLabel={`$${cp.price.toFixed(2)}`}
                          image={cp.image}
                          variantId={cp.variantId}
                          href={`/pest-control/${cp.slug}`}
                        />
                      ))}
                    </div>
                  )}

                  {m.products && m.products.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {m.products.map((p) => (
                        <ChatProductCard
                          key={p.slug}
                          slug={p.slug}
                          name={p.name}
                          subtitle={p.tagline}
                          price={p.priceFrom}
                          priceLabel={`From $${p.priceFrom.toFixed(2)}`}
                          image={p.image}
                          variantId={p.variantId}
                          href={`/product/${p.slug}`}
                        />
                      ))}
                    </div>
                  )}

                  {/* Tappable answer buttons — only on the latest message, so
                      they disappear once the visitor replies (tap or typed). */}
                  {m.questions &&
                    m.questions.length > 0 &&
                    i === messages.length - 1 &&
                    !loading && (
                      <div className="mt-3 space-y-3">
                        {m.questions.map((q) => (
                          <div key={q.key}>
                            <p className="text-xs font-medium text-charcoal/60 mb-1.5">
                              {q.question}
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {q.options.map((opt) => {
                                const selected =
                                  selectedAnswers[q.key] === opt.value;
                                return (
                                  <button
                                    key={opt.label}
                                    type="button"
                                    onClick={() =>
                                      handleSelectOption(
                                        m.questions!,
                                        q.key,
                                        opt.value,
                                      )
                                    }
                                    className={
                                      selected
                                        ? "rounded-full bg-pine text-parchment text-xs font-medium px-3 py-1.5 transition-colors"
                                        : "rounded-full border border-pine/20 bg-white text-pine text-xs font-medium px-3 py-1.5 hover:border-gold/60 transition-colors"
                                    }
                                  >
                                    {opt.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                        {Object.keys(selectedAnswers).length > 0 &&
                          !m.questions.every((q) => selectedAnswers[q.key]) && (
                            <button
                              type="button"
                              onClick={() =>
                                sendSelectedAnswers(
                                  m.questions!,
                                  selectedAnswers,
                                )
                              }
                              className="rounded-full bg-gold text-pine-dark text-xs font-semibold px-4 py-1.5 hover:bg-gold-light transition-colors"
                            >
                              Send answers
                            </button>
                          )}
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
                    key={s.label}
                    type="button"
                    onClick={() =>
                      s.questions
                        ? startPreferenceFlow(s.label, s.questions)
                        : sendMessage(s.label)
                    }
                    className="w-full rounded-full border border-pine/15 bg-white/70 px-4 py-2 text-sm text-pine text-center hover:border-gold/50 hover:bg-white transition-colors"
                  >
                    {s.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={startPestIdentification}
                  className="w-full rounded-full border border-pine/15 bg-white/70 px-4 py-2 text-sm text-pine text-center hover:border-gold/50 hover:bg-white transition-colors"
                >
                  {PEST_ID_LABEL}
                </button>
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
        aria-label={
          open ? "Close lawn care assistant" : "Open lawn care assistant"
        }
        className="w-14 h-14 rounded-full bg-pine text-parchment shadow-xl flex items-center justify-center hover:bg-pine-dark transition-colors text-2xl"
      >
        {open ? "×" : "💬"}
      </button>
    </div>
  );
}
