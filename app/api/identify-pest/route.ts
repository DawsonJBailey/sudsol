import { NextRequest, NextResponse } from "next/server";
import { pests } from "@/lib/pests";
import { SUPPORTED_IMAGE_MEDIA_TYPES, sniffImageMediaType } from "@/lib/image";
import { buildReferenceContentBlocks } from "@/lib/pest-reference-images";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

// Per-IP limit for the standalone identifier: single-shot classifications, so
// a lower ceiling than the conversational endpoint.
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 5 * 60 * 1000;

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const rate = checkRateLimit("identify-pest", getClientIp(req), RATE_LIMIT, RATE_WINDOW_MS);
    if (!rate.ok) {
      return NextResponse.json(
        { error: "Too many identification requests. Give it a minute and try again." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
      );
    }

    const { image } = await req.json();

    if (!image || typeof image !== "string") {
      return NextResponse.json({ error: "Missing image data" }, { status: 400 });
    }

    // The client normalizes uploads to ≤1568px JPEG, far below this — anything
    // bigger is a direct-to-API abuser padding our Anthropic bill.
    if (image.length > 8 * 1024 * 1024) {
      return NextResponse.json({ error: "Image too large." }, { status: 400 });
    }

    const imageBuffer = Buffer.from(image, "base64");
    const mediaType = sniffImageMediaType(imageBuffer);

    if (!mediaType || !SUPPORTED_IMAGE_MEDIA_TYPES.includes(mediaType)) {
      return NextResponse.json(
        { error: "Unsupported image format. Please upload a JPEG, PNG, GIF, or WebP image." },
        { status: 400 }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Server is missing ANTHROPIC_API_KEY. Add it to .env.local." },
        { status: 500 }
      );
    }

    const pestList = pests
      .map((p) => `- ${p.slug} (${p.name}): ${p.identification} Damage signs: ${p.damageSigns}`)
      .join("\n");

    const systemPrompt = `You are a lawn pest identification assistant for a turfgrass company.
You will first be shown labeled reference photos of how each known pest damages turf, then a
photo a customer believes shows a lawn pest (which may be the insect itself or the lawn damage
it caused). Compare the customer's photo against the reference examples and the criteria below,
and classify it into the single best-matching known pest by slug, or return "unknown" only if the
image doesn't match any of these pests or their signs at all:

${pestList}

Judge by the pest or its telltale sign itself, not by whether the plant shown is grass. If you
recognize one of these pests or its characteristic sign (e.g. spittlebug froth, skeletonized
blades, mole cricket tunnels), identify it even when it appears on a weed, ornamental, or other
plant rather than on turfgrass — do not answer "unknown" merely because it isn't on grass.

Be honest about uncertainty. Chinch bugs, hunting billbugs, white grubs, and fall armyworms all
produce nearly identical irregular brown, drought-like patches in a wide lawn photo, so when no
insect is visible and the image is that generic patchy damage, still give your single best guess
but set confidence to 0.5 or below, and in the reasoning name the other likely possibilities and
the quick test that tells them apart (e.g. turf peeling up like carpet = grubs; grass tugging out
with no root resistance = billbugs; damage worst at hot dry edges = chinch bugs). Only use high
confidence when the photo genuinely supports it — a visible insect or a distinctive pattern like
mole cricket tunnels, skeletonized blades, or spittlebug froth.

Respond with ONLY a JSON object, no other text, no markdown fences, in this exact shape:
{"pestSlug": "<slug or unknown>", "confidence": <number 0 to 1>, "reasoning": "<one or two sentences>"}`;

    // Prepend labeled reference photos of each pest's damage pattern so the model
    // classifies few-shot against real examples instead of zero-shot from memory.
    const referenceBlocks = buildReferenceContentBlocks();

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 300,
        // Cache the static system prompt (+ tools if any render first). The
        // reference-image blocks carry their own cache breakpoint, so both the
        // prompt and the ~11k reference-image tokens are reused across requests.
        system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
        messages: [
          {
            role: "user",
            content: [
              ...referenceBlocks,
              { type: "text", text: "Here is the customer's photo to identify:" },
              {
                type: "image",
                source: { type: "base64", media_type: mediaType, data: image },
              },
              { type: "text", text: "Identify this lawn pest." },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic API error:", errText);
      return NextResponse.json({ error: "AI classification failed" }, { status: 502 });
    }

    const data = await response.json();
    const usage = data.usage ?? {};
    console.log(
      `identify-pest cache: read=${usage.cache_read_input_tokens ?? 0} write=${usage.cache_creation_input_tokens ?? 0} uncached=${usage.input_tokens ?? 0}`
    );
    const textBlock = data.content?.find((b: { type: string }) => b.type === "text");

    if (!textBlock) {
      return NextResponse.json({ error: "No response from model" }, { status: 502 });
    }

    let parsed: { pestSlug: string; confidence: number; reasoning: string };
    try {
      const cleaned = textBlock.text.replace(/```json|```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse model response:", textBlock.text);
      return NextResponse.json({ error: "Could not parse AI response" }, { status: 502 });
    }

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("identify-pest route error:", err);
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
  }
}
