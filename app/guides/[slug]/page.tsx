import { guides } from "@/lib/data";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

export function generateStaticParams() {
  return guides.map((g) => ({ slug: g.slug }));
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = guides.find((g) => g.slug === slug);
  if (!guide) return notFound();

  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <p className="text-xs uppercase tracking-widest text-gold font-semibold mb-2">
        {guide.category}
      </p>
      <h1 className="font-display text-3xl md:text-4xl text-pine mb-8">{guide.title}</h1>

      <div className="relative aspect-[16/9] rounded-2xl overflow-hidden mb-10">
        <Image
          src={guide.image.src}
          alt={guide.image.alt}
          fill
          sizes="(min-width: 768px) 768px, 100vw"
          priority
          className="object-cover"
        />
      </div>

      <div className="space-y-5">
        {guide.body.map((para, i) => (
          <p key={i} className="text-charcoal/80 leading-relaxed text-lg">
            {para}
          </p>
        ))}
      </div>

      <Link
        href="/guides"
        className="inline-block mt-12 text-gold font-medium hover:underline"
      >
        ← Back to all guides
      </Link>
    </div>
  );
}
