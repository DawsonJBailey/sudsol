"use client";

import { useEffect, useState } from "react";
import { Elements } from "@stripe/react-stripe-js";
import { useCart } from "@/components/CartContext";
import { getStripe } from "@/lib/stripe-client";
import CheckoutForm from "@/components/CheckoutForm";

export default function CheckoutPage() {
  const { items, subtotal } = useCart();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (items.length === 0) return;

    let cancelled = false;
    setClientSecret(null);
    setError(null);

    fetch("/api/create-payment-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: items.map((item) => ({ slug: item.slug, quantity: item.quantity })),
      }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? "Failed to start checkout");
        if (!cancelled) setClientSecret(data.clientSecret);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message ?? "Failed to start checkout");
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.map((item) => `${item.slug}:${item.quantity}`).join(",")]);

  if (items.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-24 text-center">
        <h1 className="font-display text-3xl text-pine mb-4">Your cart is empty</h1>
        <p className="text-charcoal/70">Add something to your cart before checking out.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-16">
      <h1 className="font-display text-3xl text-pine mb-10">Checkout</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        {error && <p className="text-sm text-clay">{error}</p>}
        {!error && !clientSecret && (
          <p className="text-charcoal/60">Preparing checkout…</p>
        )}
        {clientSecret && (
          <Elements
            stripe={getStripe()}
            options={{ clientSecret, appearance: { theme: "stripe" } }}
          >
            <CheckoutForm />
          </Elements>
        )}

        <div>
          <h2 className="font-display text-xl text-pine mb-4">Order summary</h2>
          <div className="rounded-2xl border border-pine/10 bg-white/60 divide-y divide-pine/10">
            {items.map((item) => (
              <div key={item.slug} className="flex justify-between px-5 py-3 text-sm">
                <span>
                  {item.name} <span className="text-charcoal/50">× {item.quantity}</span>
                </span>
                <span className="font-medium">${(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
            <div className="flex justify-between px-5 py-4 font-semibold">
              <span>Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
