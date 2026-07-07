import Image from "next/image";
import Link from "next/link";
import { Product } from "@/lib/data";

export default function ProductCard({ product }: { product: Product }) {
  return (
    <Link
      href={`/product/${product.slug}`}
      className="group block rounded-2xl bg-white/60 border border-pine/10 overflow-hidden hover:shadow-lg hover:border-gold/40 transition-all"
    >
      <div className="relative aspect-[4/3] bg-gradient-to-br from-pine to-pine-dark">
        <Image
          src={product.image.src}
          alt={product.image.alt}
          fill
          sizes="(min-width: 768px) 25vw, 50vw"
          className="object-cover group-hover:scale-105 transition-transform duration-300"
        />
      </div>
      <div className="p-5">
        <h3 className="font-display text-lg text-pine group-hover:text-gold transition-colors">
          {product.name}
        </h3>
        <p className="text-sm text-charcoal/70 mt-1 line-clamp-2">{product.tagline}</p>
        <p className="text-sm font-semibold text-charcoal mt-3">
          From ${product.priceFrom.toFixed(2)}
        </p>
      </div>
    </Link>
  );
}
