"use client";

import Link from "next/link";
import { useCart } from "@/components/CartContext";

export default function CartPage() {
  const { items, removeItem, updateQuantity, subtotal } = useCart();

  if (items.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-24 text-center">
        <h1 className="font-display text-3xl text-pine mb-4">Your cart is empty</h1>
        <p className="text-charcoal/70 mb-8">
          Browse our varieties and find the right fit for your lawn.
        </p>
        <Link
          href="/shop/sod"
          className="inline-block bg-pine text-parchment font-medium px-7 py-3 rounded-full hover:bg-pine-dark transition-colors"
        >
          Shop Varieties
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <h1 className="font-display text-3xl text-pine mb-8">Your Cart</h1>

      <div className="space-y-4 mb-8">
        {items.map((item) => (
          <div
            key={item.slug}
            className="flex items-center justify-between rounded-xl border border-pine/10 bg-white/60 p-4"
          >
            <div>
              <p className="font-medium text-charcoal">{item.name}</p>
              <p className="text-sm text-charcoal/60">${item.price.toFixed(2)} each</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => updateQuantity(item.slug, item.quantity - 1)}
                  className="w-7 h-7 rounded-full border border-pine/20 text-pine hover:bg-parchment-dark"
                  aria-label={`Decrease quantity of ${item.name}`}
                >
                  −
                </button>
                <span className="w-6 text-center">{item.quantity}</span>
                <button
                  onClick={() => updateQuantity(item.slug, item.quantity + 1)}
                  className="w-7 h-7 rounded-full border border-pine/20 text-pine hover:bg-parchment-dark"
                  aria-label={`Increase quantity of ${item.name}`}
                >
                  +
                </button>
              </div>
              <button
                onClick={() => removeItem(item.slug)}
                className="text-sm text-clay hover:underline"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-between items-center border-t border-pine/10 pt-6">
        <span className="text-lg font-semibold text-charcoal">Subtotal</span>
        <span className="text-lg font-semibold text-charcoal">${subtotal.toFixed(2)}</span>
      </div>

      <Link
        href="/checkout"
        className="block w-full mt-6 bg-pine text-parchment font-medium py-3 rounded-full hover:bg-pine-dark transition-colors text-center"
      >
        Checkout
      </Link>
    </div>
  );
}
