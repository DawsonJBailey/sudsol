import { NextRequest, NextResponse } from "next/server";
import { recommendProducts, type LawnPreferences } from "@/lib/data";
import { getProducts } from "@/lib/shopify/catalog";
import { pests, controlProducts } from "@/lib/pests";
import { SUPPORTED_IMAGE_MEDIA_TYPES, sniffImageMediaType } from "@/lib/image";

export const runtime = "nodejs";

type ChatContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; mediaType: string; data: string };

type ChatMessage = { role: "user" | "assistant"; content: string | ChatContentBlock[] };

const pestSlugList = pests.map((p) => `${p.slug}: ${p.name}`).join("\n");

const SYSTEM_PROMPT = `You are the Meridian Turf lawn care assistant, embedded as a chat widget on our storefront.

You have two jobs:

1. Help visitors pick the right sod, seed, or plug product by asking about, at most a couple at a time:
- Full sun or shade
- High traffic or low traffic
- Low maintenance vs. best appearance
- Starting a new lawn vs. filling bare spots
Do not ask about location, climate, ZIP code, hardiness zone, or region — we intentionally don't use that for recommendations, so redirect if asked.
Once you have at least one clear preference, call the recommend_products tool to fetch real matching products before recommending anything.

2. If a visitor attaches a photo of an insect or lawn damage, identify which of these known lawn pests it matches by slug, or "unknown" if it doesn't clearly match one of these or isn't a lawn pest at all:
${pestSlugList}
Then call the identify_pest tool with that slug to fetch the real treatment info before responding.

Never state a product name, price, spec, pest name, or treatment unless it came back from one of these tools — do not invent or recall facts from memory. If a tool returns no match, say so plainly rather than making something up. Keep replies short and conversational.`;

const RECOMMEND_PRODUCTS_TOOL = {
  name: "recommend_products",
  description:
    "Look up real Meridian Turf catalog products matching the visitor's stated lawn preferences. Always call this before recommending any specific product by name.",
  input_schema: {
    type: "object" as const,
    properties: {
      sun: { type: "string", enum: ["full-sun", "shade"] },
      traffic: { type: "string", enum: ["high", "low"] },
      maintenance: { type: "string", enum: ["low", "best-appearance"] },
      goal: { type: "string", enum: ["new-lawn", "bare-spot-repair"] },
    },
  },
};

const IDENTIFY_PEST_TOOL = {
  name: "identify_pest",
  description:
    "Look up treatment info for a known lawn pest by slug after visually identifying it from a photo the visitor attached. Always call this before naming a pest or treatment.",
  input_schema: {
    type: "object" as const,
    properties: {
      pestSlug: { type: "string", enum: [...pests.map((p) => p.slug), "unknown"] },
    },
    required: ["pestSlug"],
  },
};

const MAX_TOOL_ROUNDS = 4;

async function callAnthropic(apiKey: string, messages: unknown[]) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 600,
      system: SYSTEM_PROMPT,
      tools: [RECOMMEND_PRODUCTS_TOOL, IDENTIFY_PEST_TOOL],
      messages,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("Anthropic API error:", errText);
    throw new Error("AI request failed");
  }

  return response.json();
}

function toAnthropicContent(content: string | ChatContentBlock[]) {
  if (typeof content === "string") return content;

  return content.map((block) => {
    if (block.type === "text") return { type: "text", text: block.text };

    const imageBuffer = Buffer.from(block.data, "base64");
    const mediaType = sniffImageMediaType(imageBuffer);

    if (!mediaType || !SUPPORTED_IMAGE_MEDIA_TYPES.includes(mediaType)) {
      throw new Error("Unsupported image format. Please upload a JPEG, PNG, GIF, or WebP image.");
    }

    return {
      type: "image",
      source: { type: "base64", media_type: mediaType, data: block.data },
    };
  });
}

export async function POST(req: NextRequest) {
  try {
    const { messages } = (await req.json()) as { messages: ChatMessage[] };

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Missing messages" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Server is missing ANTHROPIC_API_KEY. Add it to .env.local." },
        { status: 500 }
      );
    }

    let anthropicMessages: unknown[];
    try {
      anthropicMessages = messages.map((m) => ({
        role: m.role,
        content: toAnthropicContent(m.content),
      }));
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Invalid image" },
        { status: 400 }
      );
    }

    let data = await callAnthropic(apiKey, anthropicMessages);
    let recommended: ReturnType<typeof recommendProducts> = [];
    let identifiedPest: (typeof pests)[number] | null = null;
    let controlProduct: (typeof controlProducts)[number] | null = null;

    for (let round = 0; data.stop_reason === "tool_use" && round < MAX_TOOL_ROUNDS; round++) {
      const toolUseBlocks = (
        data.content as Array<{ type: string; id: string; name: string; input: Record<string, unknown> }>
      ).filter((b) => b.type === "tool_use");

      if (toolUseBlocks.length === 0) break;

      const toolResults = await Promise.all(toolUseBlocks.map(async (block) => {
        if (block.name === "recommend_products") {
          // Same 5-minute fetch cache as the storefront pages.
          const catalog = await getProducts();
          recommended = recommendProducts((block.input ?? {}) as LawnPreferences, catalog);
          const payload = recommended.map((p) => ({
            slug: p.slug,
            name: p.name,
            category: p.category,
            tagline: p.tagline,
            priceFrom: p.priceFrom,
            specs: p.specs,
            maintenance: p.maintenance,
            bestFor: p.bestFor,
          }));
          return {
            type: "tool_result" as const,
            tool_use_id: block.id,
            content: JSON.stringify(payload.length > 0 ? payload : { message: "No products matched." }),
          };
        }

        if (block.name === "identify_pest") {
          const pestSlug = block.input?.pestSlug as string | undefined;
          const pest = pests.find((p) => p.slug === pestSlug) ?? null;
          const product = pest ? controlProducts.find((c) => c.slug === pest.controlSlug) ?? null : null;
          identifiedPest = pest;
          controlProduct = product;

          return {
            type: "tool_result" as const,
            tool_use_id: block.id,
            content: pest
              ? JSON.stringify({
                  pest: { slug: pest.slug, name: pest.name, damageSigns: pest.damageSigns },
                  treatment: product,
                })
              : JSON.stringify({ message: "No confident match against known lawn pests." }),
          };
        }

        return {
          type: "tool_result" as const,
          tool_use_id: block.id,
          content: JSON.stringify({ message: "Unknown tool." }),
        };
      }));

      anthropicMessages.push({ role: "assistant", content: data.content }, { role: "user", content: toolResults });
      data = await callAnthropic(apiKey, anthropicMessages);
    }

    const textBlock = (data.content as Array<{ type: string; text?: string }>)?.find((b) => b.type === "text");

    if (!textBlock?.text) {
      return NextResponse.json({ error: "No response from model" }, { status: 502 });
    }

    return NextResponse.json({
      reply: textBlock.text,
      products: recommended,
      pest: identifiedPest,
      controlProduct,
    });
  } catch (err) {
    console.error("lawn-assistant route error:", err);
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
  }
}
