"use client";

import { controlProducts } from "@/lib/pests";
import { useCart } from "@/components/CartContext";
import { useState } from "react";

export default function PestControlPage() {
  const { addItem } = useCart();
  const [added, setAdded] = useState<string | null>(null);

  function handleAdd(slug: string, name: string, price: number) {
    addItem({ slug, name, price });
    setAdded(slug);
    setTimeout(() => setAdded(null), 1500);
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-16">
      <p className="text-xs uppercase tracking-widest text-gold font-semibold mb-2">Shop</p>
      <h1 className="font-display text-3xl md:text-4xl text-pine mb-3">Pest Control</h1>
      <p className="text-charcoal/70 max-w-xl mb-10">
        Treatments matched to the most common lawn pests. Not sure what you're dealing
        with? Try the AI pest identifier first.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {controlProducts.map((product) => (
          <div
            key={product.slug}
            className="rounded-2xl bg-white/60 border border-pine/10 p-6 flex flex-col"
          >
            <h2 className="font-display text-lg text-pine mb-1">{product.name}</h2>
            <p className="text-xs text-charcoal/50 mb-3">
              Active ingredient: {product.activeIngredient}
            </p>
            <p className="text-sm text-charcoal/70 flex-1 mb-4">{product.description}</p>
            <p className="text-lg font-semibold text-charcoal mb-4">
              ${product.price.toFixed(2)}
            </p>
            <button
              onClick={() => handleAdd(product.slug, product.name, product.price)}
              className="bg-pine text-parchment font-medium py-2.5 rounded-full hover:bg-pine-dark transition-colors"
            >
              {added === product.slug ? "Added ✓" : "Add to Cart"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
