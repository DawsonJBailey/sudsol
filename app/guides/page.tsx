import Image from "next/image";
import Link from "next/link";
import { guides } from "@/lib/data";

export default function GuidesPage() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      <p className="text-xs uppercase tracking-widest text-gold font-semibold mb-2">Resources</p>
      <h1 className="font-display text-3xl md:text-4xl text-pine mb-3">Lawn Guides</h1>
      <p className="text-charcoal/70 max-w-xl mb-10">
        Practical, season-specific advice for keeping your lawn healthy year-round.
      </p>

      <div className="rounded-2xl bg-pine text-parchment p-6 mb-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-gold-light font-semibold mb-2">
            Featured
          </p>
          <h2 className="font-display text-xl mb-1">Insect Identification</h2>
          <p className="text-sm text-parchment/70">
            Identify common lawn pests and find the right treatment — including an AI photo identifier.
          </p>
        </div>
        <Link
          href="/guides/pest-identification"
          className="bg-gold text-pine-dark font-semibold px-6 py-2.5 rounded-full hover:bg-gold-light transition-colors whitespace-nowrap"
        >
          View Guide →
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                sizes="(min-width: 768px) 50vw, 100vw"
                className="object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </div>
            <div className="p-6">
              <p className="text-xs uppercase tracking-wide text-gold font-semibold mb-2">
                {g.category}
              </p>
              <h2 className="font-display text-xl text-pine mb-2">{g.title}</h2>
              <p className="text-sm text-charcoal/70">{g.excerpt}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
