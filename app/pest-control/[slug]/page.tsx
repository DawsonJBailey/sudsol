import { controlProducts, pests } from "@/lib/pests";
import { notFound } from "next/navigation";
import Image from "next/image";
import AddToCartButton from "@/components/AddToCartButton";

export function generateStaticParams() {
  return controlProducts.map((p) => ({ slug: p.slug }));
}

export default function PestControlProductPage({ params }: { params: { slug: string } }) {
  const product = controlProducts.find((p) => p.slug === params.slug);
  if (!product) return notFound();

  const targetedPests = pests.filter((pest) => pest.controlSlug === product.slug);

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

        <div>
          <p className="text-xs uppercase tracking-widest text-gold font-semibold mb-2">
            Pest Control
          </p>
          <h1 className="font-display text-3xl md:text-4xl text-pine mb-3">{product.name}</h1>
          <p className="text-charcoal/70 text-lg mb-6">
            Active ingredient: {product.activeIngredient}
          </p>
          <p className="text-2xl font-semibold text-charcoal mb-6">
            ${product.price.toFixed(2)}
          </p>

          <div className="flex flex-col sm:flex-row gap-3 mb-8">
            <AddToCartButton slug={product.slug} name={product.name} price={product.price} />
          </div>

          <p className="text-charcoal/80 leading-relaxed mb-8">{product.description}</p>

          {targetedPests.length > 0 && (
            <div className="rounded-2xl border border-pine/10 overflow-hidden">
              <div className="px-5 py-3 text-xs uppercase tracking-widest text-gold font-semibold bg-white/60">
                Effective against
              </div>
              {targetedPests.map((pest, i) => (
                <div
                  key={pest.slug}
                  className={`px-5 py-3 text-sm ${i % 2 === 0 ? "bg-white/60" : "bg-transparent"}`}
                >
                  <span className="font-medium text-charcoal">{pest.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
