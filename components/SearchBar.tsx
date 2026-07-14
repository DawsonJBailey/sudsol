"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { guides } from "@/lib/data";

export type SearchProduct = { slug: string; name: string; tagline: string };

type SearchResult = {
  type: "product" | "guide";
  slug: string;
  title: string;
  subtitle: string;
  href: string;
};

const guideIndex: SearchResult[] = guides.map((g) => ({
  type: "guide" as const,
  slug: g.slug,
  title: g.title,
  subtitle: g.excerpt,
  href: `/guides/${g.slug}`,
}));

export default function SearchBar({ products = [] }: { products?: SearchProduct[] }) {
  const [query, setQuery] = useState("");
  const [resultsVisible, setResultsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const searchIndex = useMemo<SearchResult[]>(
    () => [
      ...products.map((p) => ({
        type: "product" as const,
        slug: p.slug,
        title: p.name,
        subtitle: p.tagline,
        href: `/product/${p.slug}`,
      })),
      ...guideIndex,
    ],
    [products]
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return searchIndex
      .filter(
        (r) => r.title.toLowerCase().includes(q) || r.subtitle.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [query, searchIndex]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setResultsVisible(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function clearQuery() {
    setQuery("");
  }

  return (
    <div className="relative" ref={containerRef}>
      <div className="flex items-center gap-2 rounded-full border border-pine/20 bg-white px-3 py-2">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          className="h-4 w-4 shrink-0 text-pine/60"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" strokeLinecap="round" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setResultsVisible(true);
          }}
          onFocus={() => setResultsVisible(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              clearQuery();
              setResultsVisible(false);
            }
          }}
          placeholder="Search products & guides…"
          className="w-40 sm:w-56 bg-transparent text-sm text-charcoal placeholder:text-charcoal/40 focus:outline-none"
        />
        {query ? (
          <button
            type="button"
            onClick={clearQuery}
            aria-label="Clear search"
            className="text-charcoal/40 hover:text-charcoal shrink-0"
          >
            ×
          </button>
        ) : null}
      </div>

      {resultsVisible && query.trim() ? (
        <div className="absolute right-0 mt-2 w-80 rounded-lg border border-pine/10 bg-white shadow-lg z-40 max-h-96 overflow-y-auto">
          {results.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-sm text-charcoal/60">No results for &ldquo;{query}&rdquo;</p>
            </div>
          ) : (
            <div className="py-2">
              {results.map((r) => (
                <Link
                  key={`${r.type}-${r.slug}`}
                  href={r.href}
                  onClick={() => {
                    clearQuery();
                    setResultsVisible(false);
                  }}
                  className="block px-4 py-2 hover:bg-parchment"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-charcoal truncate">{r.title}</p>
                    <span className="shrink-0 text-[10px] uppercase tracking-wide text-pine/70 font-semibold">
                      {r.type === "product" ? "Shop" : "Guide"}
                    </span>
                  </div>
                  <p className="text-xs text-charcoal/60 truncate">{r.subtitle}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
