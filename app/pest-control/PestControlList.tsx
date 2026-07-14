"use client";

import Image from "next/image";
import Link from "next/link";
import type { ControlProduct } from "@/lib/pests";
import { useCart } from "@/components/CartContext";
import { useState } from "react";

type ControlItem = ControlProduct & { variantId: string };

export default function PestControlList({ products }: { products: ControlItem[] }) {
  const { addItem } = useCart();
  const [added, setAdded] = useState<string | null>(null);

  function handleAdd(e: React.MouseEvent, product: ControlItem) {
    e.preventDefault();
    e.stopPropagation();
    addItem({
      slug: product.slug,
      name: product.name,
      price: product.price,
      variantId: product.variantId,
    });
    setAdded(product.slug);
    setTimeout(() => setAdded(null), 1500);
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {products.map((product) => (
        <Link
          key={product.slug}
          href={`/pest-control/${product.slug}`}
          className="group block rounded-2xl bg-white/60 border border-pine/10 overflow-hidden hover:shadow-lg hover:border-gold/40 transition-all flex flex-col"
        >
          <div className="relative aspect-[4/3] bg-gradient-to-br from-pine to-pine-dark">
            <Image
              src={product.image.src}
              alt={product.image.alt}
              fill
              sizes="(min-width: 768px) 33vw, 100vw"
              className="object-cover group-hover:scale-105 transition-transform duration-300"
            />
          </div>
          <div className="p-6 flex flex-col flex-1">
            <h2 className="font-display text-lg text-pine group-hover:text-gold transition-colors mb-1">
              {product.name}
            </h2>
            <p className="text-xs text-charcoal/50 mb-3">
              Active ingredient: {product.activeIngredient}
            </p>
            <p className="text-sm text-charcoal/70 flex-1 mb-4">{product.description}</p>
            <p className="text-lg font-semibold text-charcoal mb-4">
              ${product.price.toFixed(2)}
            </p>
            <button
              onClick={(e) => handleAdd(e, product)}
              className="bg-pine text-parchment font-medium py-2.5 rounded-full hover:bg-pine-dark transition-colors"
            >
              {added === product.slug ? "Added ✓" : "Add to Cart"}
            </button>
          </div>
        </Link>
      ))}
    </div>
  );
}
