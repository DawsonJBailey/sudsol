import Image from "next/image";
import Link from "next/link";
import { guides } from "@/lib/data";
import { getProducts } from "@/lib/shopify/catalog";
import ProductCard from "@/components/ProductCard";
import HeroSlideshow from "@/components/HeroSlideshow";
import NewsletterForm from "@/components/NewsletterForm";

const categories = [
  {
    slug: "sod",
    label: "Sod",
    blurb: "Established lawn in a single afternoon",
    image: {
      src: "https://images.pexels.com/photos/5231232/pexels-photo-5231232.jpeg?auto=compress&cs=tinysrgb&w=1200",
      alt: "Landscaper laying fresh sod for a new lawn",
    },
  },
  {
    slug: "seed",
    label: "Seed",
    blurb: "Overseed thin spots or start from scratch",
    image: {
      src: "https://images.pexels.com/photos/8891505/pexels-photo-8891505.jpeg?auto=compress&cs=tinysrgb&w=1200",
      alt: "Grass sprouting from bare soil",
    },
  },
  {
    slug: "plugs",
    label: "Plugs",
    blurb: "Affordable spot repair and DIY conversion",
    image: {
      src: "https://images.pexels.com/photos/12367583/pexels-photo-12367583.jpeg?auto=compress&cs=tinysrgb&w=1200",
      alt: "Close-up of individual backlit grass blades",
    },
  },
];

export const revalidate = 300;

export default async function HomePage() {
  const products = await getProducts();

  return (
    <div>
      {/* Hero */}
      <section className="relative bg-pine text-parchment overflow-hidden">
        <HeroSlideshow />
        <div className="relative max-w-6xl mx-auto px-6 py-24 md:py-32">
          <p className="uppercase tracking-widest text-gold-light text-sm font-medium mb-4">
            30 years of turfgrass research
          </p>
          <h1 className="font-display text-4xl md:text-6xl font-600 max-w-2xl leading-tight">
            Grass that's bred to perform, not just to grow.
          </h1>
          <p className="mt-6 text-parchment/80 max-w-xl text-lg">
            Find the right sod, seed, or plug variety for your climate, your
            soil, and how hard your lawn actually gets used.
          </p>
          <Link
            href="/shop/sod"
            className="inline-block mt-8 bg-gold text-pine-dark font-semibold px-7 py-3 rounded-full hover:bg-gold-light transition-colors"
          >
            Shop Varieties
          </Link>
        </div>
      </section>

      {/* Category tiles */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="font-display text-2xl text-pine mb-8">
          Start with how you want to plant
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {categories.map((cat) => (
            <Link
              key={cat.slug}
              href={`/shop/${cat.slug}`}
              className="group rounded-2xl border border-pine/10 bg-white/60 overflow-hidden hover:border-gold/50 hover:shadow-md transition-all"
            >
              <div className="relative aspect-[16/9]">
                <Image
                  src={cat.image.src}
                  alt={cat.image.alt}
                  fill
                  sizes="(min-width: 768px) 33vw, 100vw"
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="p-8">
                <h3 className="font-display text-xl text-pine mb-2">
                  {cat.label}
                </h3>
                <p className="text-charcoal/70 text-sm">{cat.blurb}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured products */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="flex items-center justify-between mb-8">
          <h2 className="font-display text-2xl text-pine">
            Featured varieties
          </h2>
          <Link
            href="/shop/sod"
            className="text-gold font-medium hover:underline"
          >
            View all →
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
          {products.map((p) => (
            <ProductCard key={p.slug} product={p} />
          ))}
        </div>
      </section>

      {/* Guides preview */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="flex items-center justify-between mb-8">
          <h2 className="font-display text-2xl text-pine">
            From the lawn guide
          </h2>
          <Link
            href="/guides"
            className="text-gold font-medium hover:underline"
          >
            All guides →
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {guides.map((g) => (
            <Link
              key={g.slug}
              href={`/guides/${g.slug}`}
              className="group rounded-2xl bg-white/60 border border-pine/10 overflow-hidden hover:border-gold/50 hover:shadow-md transition-all"
            >
              <div className="relative aspect-[16/9]">
                <Image
                  src={g.image.src}
                  alt={g.image.alt}
                  fill
                  sizes="(min-width: 768px) 33vw, 100vw"
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="p-6">
                <p className="text-xs uppercase tracking-wide text-gold font-semibold mb-2">
                  {g.category}
                </p>
                <h3 className="font-display text-lg text-pine mb-2">{g.title}</h3>
                <p className="text-sm text-charcoal/70">{g.excerpt}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Newsletter CTA */}
      <section className="bg-parchment-dark">
        <div className="max-w-6xl mx-auto px-6 py-16 text-center">
          <h2 className="font-display text-2xl text-pine mb-3">
            Get seasonal lawn tips
          </h2>
          <p className="text-charcoal/70 mb-6">
            One email a month — no spam, just what to do and when.
          </p>
          <NewsletterForm />
        </div>
      </section>
    </div>
  );
}
