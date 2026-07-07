import { products } from "@/lib/data";
import { notFound } from "next/navigation";
import Image from "next/image";
import AddToCartButton from "@/components/AddToCartButton";

export function generateStaticParams() {
  return products.map((p) => ({ slug: p.slug }));
}

export default function ProductPage({ params }: { params: { slug: string } }) {
  const product = products.find((p) => p.slug === params.slug);
  if (!product) return notFound();

  const specEntries = Object.entries(product.specs) as [string, string][];
  const specLabels: Record<string, string> = {
    color: "Color",
    texture: "Texture",
    wearTolerance: "Wear Tolerance",
    droughtTolerance: "Drought Tolerance",
    shadeTolerance: "Shade Tolerance",
    mowHeight: "Mow Height",
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        <div className="relative aspect-square rounded-2xl overflow-hidden bg-gradient-to-br from-pine to-pine-dark">
          <Image
            src={product.image.src}
            alt={product.image.alt}
            fill
            sizes="(min-width: 768px) 50vw, 100vw"
            priority
            className="object-cover"
          />
        </div>

        {/* Details */}
        <div>
          <p className="text-xs uppercase tracking-widest text-gold font-semibold mb-2">
            {product.category}
          </p>
          <h1 className="font-display text-3xl md:text-4xl text-pine mb-3">{product.name}</h1>
          <p className="text-charcoal/70 text-lg mb-6">{product.tagline}</p>
          <p className="text-2xl font-semibold text-charcoal mb-6">
            From ${product.priceFrom.toFixed(2)}
          </p>

          <div className="flex flex-col sm:flex-row gap-3 mb-8">
            <AddToCartButton slug={product.slug} name={product.name} price={product.priceFrom} />
            <button className="w-full sm:w-auto bg-white border border-pine/20 text-pine font-medium px-8 py-3 rounded-full hover:border-pine/40 transition-colors">
              Check Availability by ZIP
            </button>
          </div>

          <p className="text-charcoal/80 leading-relaxed mb-8">{product.description}</p>

          {/* Spec table */}
          <div className="rounded-2xl border border-pine/10 overflow-hidden">
            {specEntries.map(([key, value], i) => (
              <div
                key={key}
                className={`flex justify-between px-5 py-3 text-sm ${
                  i % 2 === 0 ? "bg-white/60" : "bg-transparent"
                }`}
              >
                <span className="text-charcoal/60">{specLabels[key]}</span>
                <span className="font-medium text-charcoal">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Growth timeline — signature element */}
      <div className="mt-20">
        <h2 className="font-display text-2xl text-pine mb-8">From install to established lawn</h2>
        <div className="relative">
          <div className="hidden md:block absolute top-6 left-0 right-0 h-px bg-pine/15" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {product.stages.map((stage, i) => (
              <div key={stage.label} className="relative">
                <div className="hidden md:flex w-3 h-3 rounded-full bg-gold absolute -top-[26px] left-0" />
                <p className="text-xs uppercase tracking-widest text-gold font-semibold mb-2">
                  Stage {i + 1}
                </p>
                <h3 className="font-display text-lg text-pine mb-2">{stage.label}</h3>
                <p className="text-sm text-charcoal/70 leading-relaxed">{stage.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
