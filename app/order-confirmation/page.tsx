import Link from "next/link";

// Shopify's hosted thank-you page is the real order confirmation now; this
// page stays as a friendly landing spot for old links.
export default function OrderConfirmationPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-24 text-center">
      <div className="w-16 h-16 rounded-full bg-gold/20 text-gold flex items-center justify-center mx-auto mb-6 text-2xl">
        ✓
      </div>
      <h1 className="font-display text-3xl text-pine mb-3">Thanks for your order</h1>
      <p className="text-charcoal/70 mb-10">
        Your order was placed through our secure Shopify checkout, and a receipt
        has been emailed to you.
      </p>
      <Link
        href="/"
        className="inline-block bg-pine text-parchment font-medium px-7 py-3 rounded-full hover:bg-pine-dark transition-colors"
      >
        Back to Home
      </Link>
    </div>
  );
}

/* ── PARKED (Stripe → Shopify migration 2026-07). To restore: delete the
   replacement above and uncomment this original page, which verified the
   Stripe PaymentIntent and recorded the order in Supabase. ──

import Link from "next/link";
import { recordOrderForPaymentIntent } from "@/lib/orders";
import ClearCartOnSuccess from "@/components/ClearCartOnSuccess";

type SearchParams = Promise<{ payment_intent?: string }>;

export default async function OrderConfirmationPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { payment_intent: paymentIntentId } = await searchParams;

  const order = paymentIntentId ? await recordOrderForPaymentIntent(paymentIntentId) : null;

  if (!order) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-24 text-center">
        <h1 className="font-display text-3xl text-pine mb-3">We couldn't confirm your order</h1>
        <p className="text-charcoal/70 mb-10">
          Your payment may not have completed. Please return to checkout and try again.
        </p>
        <Link
          href="/checkout"
          className="inline-block bg-pine text-parchment font-medium px-7 py-3 rounded-full hover:bg-pine-dark transition-colors"
        >
          Back to Checkout
        </Link>
      </div>
    );
  }

  const orderNumber = `MT-${order.stripe_payment_intent_id.slice(-6).toUpperCase()}`;

  return (
    <div className="max-w-2xl mx-auto px-6 py-24 text-center">
      <ClearCartOnSuccess />
      <div className="w-16 h-16 rounded-full bg-gold/20 text-gold flex items-center justify-center mx-auto mb-6 text-2xl">
        ✓
      </div>
      <h1 className="font-display text-3xl text-pine mb-3">Order placed</h1>
      <p className="text-charcoal/70 mb-2">
        Thanks for your order. A confirmation has been sent to your email.
      </p>
      <p className="text-charcoal/50 text-sm mb-1">Order number: {orderNumber}</p>
      <p className="text-charcoal/50 text-sm mb-10">
        Total charged: ${(order.amount_total / 100).toFixed(2)}
      </p>

      <div className="rounded-2xl border border-pine/10 bg-white/60 px-6 py-5 mb-10 text-sm text-charcoal/70">
        You can track this and all your past orders anytime from{" "}
        <Link href="/orders" className="text-pine font-medium hover:underline">
          My Orders
        </Link>
        .
      </div>

      <div className="flex items-center justify-center gap-4">
        <Link
          href="/orders"
          className="inline-block bg-pine text-parchment font-medium px-7 py-3 rounded-full hover:bg-pine-dark transition-colors"
        >
          View My Orders
        </Link>
        <Link
          href="/"
          className="inline-block text-charcoal/70 font-medium px-7 py-3 rounded-full hover:text-pine transition-colors"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}

── END PARKED ── */
