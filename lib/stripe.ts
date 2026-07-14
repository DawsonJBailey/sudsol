// PARKED: no longer imported — Stripe checkout replaced by Shopify hosted checkout (2026-07).
import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY;

if (!secretKey) {
  throw new Error("Missing STRIPE_SECRET_KEY environment variable");
}

export const stripe = new Stripe(secretKey);
