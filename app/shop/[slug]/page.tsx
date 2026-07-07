import { products } from "@/lib/data";
import ProductCard from "@/components/ProductCard";
import { notFound } from "next/navigation";

const categoryMeta: Record<string, { title: string; description: string }> = {
  sod: {
    title: "Sod",
    description: "Established lawn coverage delivered fresh-cut, ready to lay the same day it arrives.",
  },
  seed: {
    title: "Seed",
    description: "Overseed thin patches or start a new lawn from scratch at a lower upfront cost.",
  },
  plugs: {
    title: "Plugs",
    description: "Affordable, small-format trays for spot repair or gradual DIY lawn conversion.",
  },
};

export function generateStaticParams() {
  return Object.keys(categoryMeta).map((slug) => ({ slug }));
}

export default function CategoryPage({ params }: { params: { slug: string } }) {
  const meta = categoryMeta[params.slug];
  if (!meta) return notFound();

  const items = products.filter((p) => p.category === params.slug);

  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      <p className="text-xs uppercase tracking-widest text-gold font-semibold mb-2">Shop</p>
      <h1 className="font-display text-3xl md:text-4xl text-pine mb-3">{meta.title}</h1>
      <p className="text-charcoal/70 max-w-xl mb-10">{meta.description}</p>

      {items.length === 0 ? (
        <p className="text-charcoal/60">No varieties in this category yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {items.map((p) => (
            <ProductCard key={p.slug} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
