"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { pests, controlProducts } from "@/lib/pests";
import { fileToVisionJpeg } from "@/lib/image-client";

type Result = { pestSlug: string; confidence: number; reasoning: string };

export default function PestIdentifierPage() {
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setResult(null);
    setError(null);

    try {
      // Re-encode to a clean JPEG so any browser-viewable format works.
      const { dataUrl } = await fileToVisionJpeg(file);
      setPreview(dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read that image.");
    }
  }

  async function handleIdentify() {
    if (!preview) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const [, base64] = preview.split(",");

      const res = await fetch("/api/identify-pest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64 }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong identifying this image.");
        return;
      }

      setResult(data);
    } catch (err) {
      console.error(err);
      setError("Couldn't reach the identification service. Try again.");
    } finally {
      setLoading(false);
    }
  }

  const matchedPest = result ? pests.find((p) => p.slug === result.pestSlug) : null;
  const matchedProduct = matchedPest
    ? controlProducts.find((p) => p.slug === matchedPest.controlSlug)
    : null;

  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      <p className="text-xs uppercase tracking-widest text-gold font-semibold mb-2">
        AI Tool
      </p>
      <h1 className="font-display text-3xl md:text-4xl text-pine mb-3">
        AI Pest Identifier
      </h1>
      <p className="text-charcoal/70 mb-10">
        Upload a photo of the insect you found in your lawn, and we'll match it against
        common lawn pests and point you to the right treatment.
      </p>

      <div className="rounded-2xl border-2 border-dashed border-pine/20 bg-white/60 p-8 text-center mb-6">
        {preview ? (
          <img
            src={preview}
            alt="Uploaded pest photo preview"
            className="max-h-64 mx-auto rounded-xl mb-4 object-contain"
          />
        ) : (
          <p className="text-charcoal/50 mb-4">No image selected yet</p>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
          id="pest-upload"
        />
        <label
          htmlFor="pest-upload"
          className="inline-block cursor-pointer bg-white border border-pine/20 text-pine font-medium px-6 py-2.5 rounded-full hover:border-pine/40 transition-colors"
        >
          {preview ? "Choose a different photo" : "Choose a photo"}
        </label>
      </div>

      <button
        onClick={handleIdentify}
        disabled={!preview || loading}
        className="w-full bg-pine text-parchment font-medium py-3 rounded-full hover:bg-pine-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Analyzing…" : "Identify Pest"}
      </button>

      {error && (
        <div className="mt-6 rounded-xl bg-clay/10 border border-clay/30 p-4 text-sm text-clay">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-8 rounded-2xl bg-white/60 border border-pine/10 p-6">
          {matchedPest ? (
            <>
              <p className="text-xs uppercase tracking-wide text-gold font-semibold mb-1">
                {Math.round(result.confidence * 100)}% confidence
              </p>
              <h2 className="font-display text-xl text-pine mb-2">{matchedPest.name}</h2>
              <p className="text-sm text-charcoal/70 mb-4">{result.reasoning}</p>
              <p className="text-sm text-charcoal/80 mb-4">{matchedPest.damageSigns}</p>

              {matchedProduct && (
                <div className="border-t border-pine/10 pt-4 flex items-center justify-between">
                  <span className="text-sm text-charcoal/70">
                    Recommended: <span className="font-medium">{matchedProduct.name}</span>
                  </span>
                  <Link
                    href={`/pest-control/${matchedProduct.slug}`}
                    className="text-sm font-medium text-gold hover:underline"
                  >
                    View treatment →
                  </Link>
                </div>
              )}
            </>
          ) : (
            <>
              <h2 className="font-display text-xl text-pine mb-2">No confident match</h2>
              <p className="text-sm text-charcoal/70 mb-4">
                {result.reasoning || "This doesn't clearly match a known lawn pest in our database."}
              </p>
              <Link
                href="/guides/pest-identification"
                className="text-sm font-medium text-gold hover:underline"
              >
                Browse the full pest guide →
              </Link>
            </>
          )}
        </div>
      )}

      <p className="text-xs text-charcoal/40 mt-8 text-center">
        This demo uses Claude's vision capabilities to classify pests against a fixed set of
        7 common lawn insects — it isn't a substitute for a professional inspection.
      </p>
    </div>
  );
}
