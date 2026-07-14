"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Checkout now starts from the cart page, which hands off to Shopify's hosted
// checkout. This page only exists so old /checkout links and bookmarks still work.
export default function CheckoutPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/cart");
  }, [router]);

  return (
    <div className="max-w-3xl mx-auto px-6 py-24 text-center">
      <p className="text-charcoal/60">Redirecting to your cart…</p>
    </div>
  );
}

