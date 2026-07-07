import Link from "next/link";
import { pests, controlProducts } from "@/lib/pests";

export default function PestIdentificationPage() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-16">
      <p className="text-xs uppercase tracking-widest text-gold font-semibold mb-2">
        Lawn 101
      </p>
      <h1 className="font-display text-3xl md:text-4xl text-pine mb-3">
        Common Lawn Insect Identification
      </h1>
      <p className="text-charcoal/70 max-w-2xl mb-6">
        Most insect damage gets mistaken for drought stress or disease at first glance.
        Here's how to tell the difference, and what actually works once you've confirmed
        the cause.
      </p>

      <Link
        href="/pest-identifier"
        className="inline-block mb-12 bg-gold text-pine-dark font-semibold px-6 py-3 rounded-full hover:bg-gold-light transition-colors"
      >
        Try our AI Pest Identifier →
      </Link>

      <div className="space-y-6">
        {pests.map((pest) => {
          const product = controlProducts.find((p) => p.slug === pest.controlSlug);
          return (
            <div
              key={pest.slug}
              className="rounded-2xl bg-white/60 border border-pine/10 p-6 md:p-8"
            >
              <h2 className="font-display text-xl text-pine mb-3">{pest.name}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-gold font-semibold mb-1">
                    Identification
                  </p>
                  <p className="text-sm text-charcoal/80 leading-relaxed">{pest.identification}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gold font-semibold mb-1">
                    Damage Signs
                  </p>
                  <p className="text-sm text-charcoal/80 leading-relaxed">{pest.damageSigns}</p>
                </div>
              </div>
              {product && (
                <div className="flex items-center justify-between border-t border-pine/10 pt-4 mt-4">
                  <span className="text-sm text-charcoal/70">
                    Recommended treatment: <span className="font-medium text-charcoal">{product.name}</span>
                  </span>
                  <Link
                    href="/pest-control"
                    className="text-sm font-medium text-gold hover:underline"
                  >
                    View treatment →
                  </Link>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
