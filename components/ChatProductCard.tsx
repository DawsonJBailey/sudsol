"use client";

import Link from "next/link";
import { useCart } from "./CartContext";

// Compact product card used inside assistant chat replies. Shows the product
// photo, name, price and — reflecting live cart state — either an Add to Cart
// button or a quantity stepper, so the model's text can stay conversational and
// defer all product details to the card.
export default function ChatProductCard({
  slug,
  name,
  subtitle,
  price,
  priceLabel,
  image,
  variantId,
  href,
}: {
  slug: string;
  name: string;
  subtitle?: string;
  price: number;
  priceLabel: string;
  image: { src: string; alt: string };
  variantId: string;
  href: string;
}) {
  const { items, addItem, updateQuantity } = useCart();
  const quantity = items.find((i) => i.slug === slug)?.quantity ?? 0;

  return (
    <div className="rounded-xl bg-parchment border border-pine/10 overflow-hidden">
      <Link href={href} className="flex gap-3 p-2 hover:bg-white/50 transition-colors">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image.src}
          alt={image.alt}
          className="h-16 w-16 rounded-lg object-cover shrink-0 bg-white"
        />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-pine text-sm truncate">{name}</p>
          {subtitle && <p className="text-xs text-charcoal/60 mt-0.5">{subtitle}</p>}
          <p className="text-xs font-semibold text-charcoal mt-1">{priceLabel}</p>
        </div>
      </Link>
      <div className="px-2 pb-2">
        {quantity === 0 ? (
          <button
            type="button"
            onClick={() => variantId && addItem({ slug, name, price, variantId })}
            disabled={!variantId}
            className="w-full rounded-full bg-gold text-pine-dark text-xs font-semibold py-1.5 hover:bg-gold-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add to Cart
          </button>
        ) : (
          <div className="flex items-center justify-between rounded-full bg-white border border-pine/15 px-1.5 py-1">
            <button
              type="button"
              onClick={() => updateQuantity(slug, quantity - 1)}
              className="w-6 h-6 rounded-full border border-pine/20 text-pine text-sm hover:bg-parchment-dark"
              aria-label={`Decrease quantity of ${name}`}
            >
              −
            </button>
            <span className="text-xs text-charcoal">
              <span className="font-semibold">{quantity}</span> in cart
            </span>
            <button
              type="button"
              onClick={() => updateQuantity(slug, quantity + 1)}
              className="w-6 h-6 rounded-full border border-pine/20 text-pine text-sm hover:bg-parchment-dark"
              aria-label={`Increase quantity of ${name}`}
            >
              +
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
