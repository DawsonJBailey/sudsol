import Link from "next/link";

// Shopify's hosted thank-you page is the real order confirmation now; this
// page stays as a friendly landing spot for old links.
export default function OrderConfirmationPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-24 text-center">
      <div className="w-16 h-16 rounded-full bg-gold/20 text-gold flex items-center justify-center mx-auto mb-6 text-2xl">
        âœ“
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
