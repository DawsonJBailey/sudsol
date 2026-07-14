// PARKED: no longer imported — Stripe checkout replaced by Shopify hosted checkout (2026-07).
import { loadStripe, Stripe } from "@stripe/stripe-js";

let stripePromise: Promise<Stripe | null>;

export function getStripe() {
  if (!stripePromise) {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!key) {
      throw new Error("Missing NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY environment variable");
    }
    stripePromise = loadStripe(key);
  }
  return stripePromise;
}
