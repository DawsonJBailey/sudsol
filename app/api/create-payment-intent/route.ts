import { NextResponse } from "next/server";

// Checkout moved to Shopify's hosted checkout (started from the cart page).
export async function POST() {
  return NextResponse.json({ error: "Checkout has moved to Shopify" }, { status: 410 });
}

/* ── PARKED (Stripe → Shopify migration 2026-07). To restore: delete the
   replacement above and uncomment this original Stripe handler. ──

import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { products } from "@/lib/data";

type CartItemInput = {
  slug: string;
  quantity: number;
};

export async function POST(req: NextRequest) {
  const body = await req.json();
  const items: CartItemInput[] = Array.isArray(body?.items) ? body.items : [];

  if (items.length === 0) {
    return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
  }

  let amount = 0;
  for (const item of items) {
    const product = products.find((p) => p.slug === item.slug);
    const quantity = Number(item.quantity);
    if (!product || !Number.isInteger(quantity) || quantity < 1) {
      return NextResponse.json({ error: "Invalid cart item" }, { status: 400 });
    }
    amount += Math.round(product.priceFrom * 100) * quantity;
  }

  if (amount < 50) {
    return NextResponse.json({ error: "Order total is too low to process" }, { status: 400 });
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount,
    currency: "usd",
    automatic_payment_methods: { enabled: true },
    metadata: {
      cart: JSON.stringify(items),
    },
  });

  return NextResponse.json({ clientSecret: paymentIntent.client_secret });
}

── END PARKED ── */
