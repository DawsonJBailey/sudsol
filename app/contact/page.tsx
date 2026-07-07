"use client";

import { useState } from "react";

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      <p className="text-xs uppercase tracking-widest text-gold font-semibold mb-2">Support</p>
      <h1 className="font-display text-3xl md:text-4xl text-pine mb-3">Contact Us</h1>
      <p className="text-charcoal/70 mb-10">
        Questions about an order, a variety, or your lawn? We typically respond within one
        business day.
      </p>

      {submitted ? (
        <div className="rounded-2xl bg-white/60 border border-pine/10 p-8 text-center">
          <h2 className="font-display text-xl text-pine mb-2">Message sent</h2>
          <p className="text-charcoal/70">We'll get back to you soon.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-charcoal/80 mb-1">Name</label>
            <input
              required
              type="text"
              className="w-full rounded-lg border border-pine/20 px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-gold"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal/80 mb-1">Email</label>
            <input
              required
              type="email"
              className="w-full rounded-lg border border-pine/20 px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-gold"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal/80 mb-1">Order number (optional)</label>
            <input
              type="text"
              placeholder="MT-123456"
              className="w-full rounded-lg border border-pine/20 px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-gold"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal/80 mb-1">Message</label>
            <textarea
              required
              rows={5}
              className="w-full rounded-lg border border-pine/20 px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-gold"
            />
          </div>
          <button
            type="submit"
            className="bg-pine text-parchment font-medium px-8 py-3 rounded-full hover:bg-pine-dark transition-colors"
          >
            Send Message
          </button>
        </form>
      )}
    </div>
  );
}
