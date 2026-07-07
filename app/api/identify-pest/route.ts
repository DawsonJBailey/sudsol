import { NextRequest, NextResponse } from "next/server";
import { pests } from "@/lib/pests";

export const runtime = "nodejs";

const SUPPORTED_MEDIA_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;

// Browsers/OSes derive `file.type` from the file extension, which can lie
// (e.g. a WebP saved with a .jpg name). Anthropic validates the real bytes,
// so we sniff the actual format from the image's magic bytes instead of
// trusting whatever media type the client sent.
function sniffImageMediaType(buffer: Buffer): string | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    buffer.length >= 6 &&
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38
  ) {
    return "image/gif";
  }
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const { image } = await req.json();

    if (!image) {
      return NextResponse.json({ error: "Missing image data" }, { status: 400 });
    }

    const imageBuffer = Buffer.from(image, "base64");
    const mediaType = sniffImageMediaType(imageBuffer);

    if (!mediaType || !SUPPORTED_MEDIA_TYPES.includes(mediaType as (typeof SUPPORTED_MEDIA_TYPES)[number])) {
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

    const pestList = pests.map((p) => `${p.slug}: ${p.name}`).join("\n");

    const systemPrompt = `You are a lawn pest identification assistant for a turfgrass company.
You will be shown a photo a customer believes shows a lawn pest.
Classify it into exactly one of the following known pests by slug, or return "unknown" if
the image doesn't clearly match one of these or isn't a lawn pest at all:

${pestList}

Respond with ONLY a JSON object, no other text, no markdown fences, in this exact shape:
{"pestSlug": "<slug or unknown>", "confidence": <number 0 to 1>, "reasoning": "<one sentence>"}`;

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
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: [
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
