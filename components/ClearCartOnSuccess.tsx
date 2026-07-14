// PARKED: no longer imported — Stripe checkout replaced by Shopify hosted checkout (2026-07).
// The Shopify cart is consumed by a completed checkout, so CartContext clears itself on hydration.
"use client";

import { useEffect } from "react";
import { useCart } from "@/components/CartContext";

export default function ClearCartOnSuccess() {
  const { clearCart } = useCart();

  useEffect(() => {
    clearCart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
