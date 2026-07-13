"use client";

import { useState } from "react";

export default function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setError("");

    try {
      const res = await fetch("/api/newsletter-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data?.error || "Something went wrong. Please try again.");
        setStatus("error");
        return;
      }

      setStatus("success");
      setEmail("");
    } catch {
      setError("Something went wrong. Please try again.");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <p className="text-pine font-medium max-w-md mx-auto">
        You're subscribed — welcome aboard.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto">
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
          className="flex-1 rounded-full border border-pine/20 px-5 py-3 bg-white focus:outline-none focus:ring-2 focus:ring-gold"
        />
        <button
          type="submit"
          disabled={status === "submitting"}
          className="bg-pine text-parchment font-medium px-6 py-3 rounded-full hover:bg-pine-dark transition-colors disabled:opacity-60"
        >
          {status === "submitting" ? "Subscribing…" : "Subscribe"}
        </button>
      </div>
      {status === "error" && <p className="text-red-600 text-sm mt-3">{error}</p>}
    </form>
  );
}
