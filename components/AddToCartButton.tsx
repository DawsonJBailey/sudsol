"use client";

import { useState } from "react";
import { useCart } from "./CartContext";

export default function AddToCartButton({
  slug,
  name,
  price,
}: {
  slug: string;
  name: string;
  price: number;
}) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  function handleClick() {
    addItem({ slug, name, price });
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  return (
    <button
      onClick={handleClick}
      className="w-full sm:w-auto bg-gold text-pine-dark font-semibold px-8 py-3 rounded-full hover:bg-gold-light transition-colors"
    >
      {added ? "Added to Cart ✓" : "Add to Cart"}
    </button>
  );
}
