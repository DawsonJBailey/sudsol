import { NextRequest, NextResponse } from "next/server";
import { recommendProducts, type LawnPreferences } from "@/lib/data";

export const runtime = "nodejs";

type ChatMessage = { role: "user" | "assistant"; content: string };

const SYSTEM_PROMPT = `You are the Meridian Turf lawn care assistant, embedded as a chat widget on our storefront.

Your job is to help visitors pick the right sod, seed, or plug product by asking about, at most a couple at a time:
- Full sun or shade
- High traffic or low traffic
- Low maintenance vs. best appearance
- Starting a new lawn vs. filling bare spots

Do not ask about location, climate, ZIP code, hardiness zone, or region — we intentionally don't use that for recommendations, so redirect if asked.

Once you have at least one clear preference, call the recommend_products tool to fetch real matching products before recommending anything. Never state a product name, price, or spec unless it came back from that tool — do not invent or recall products from memory. If the tool returns no matches, say so plainly and suggest loosening a preference rather than making something up. Keep replies short and conversational.`;

const RECOMMEND_TOOL = {
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
      tools: [RECOMMEND_TOOL],
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

    const anthropicMessages: unknown[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    let data = await callAnthropic(apiKey, anthropicMessages);
    let recommended: ReturnType<typeof recommendProducts> = [];

    if (data.stop_reason === "tool_use") {
      const toolUseBlock = (data.content as Array<{ type: string; id: string; name: string; input: LawnPreferences }>).find(
        (b) => b.type === "tool_use"
      );

      if (toolUseBlock) {
        recommended = recommendProducts(toolUseBlock.input ?? {});

        const toolResultPayload = recommended.map((p) => ({
          slug: p.slug,
          name: p.name,
          category: p.category,
          tagline: p.tagline,
          priceFrom: p.priceFrom,
          specs: p.specs,
          maintenance: p.maintenance,
          bestFor: p.bestFor,
        }));

        anthropicMessages.push(
          { role: "assistant", content: data.content },
          {
            role: "user",
            content: [
              {
                type: "tool_result",
                tool_use_id: toolUseBlock.id,
                content: JSON.stringify(
                  toolResultPayload.length > 0 ? toolResultPayload : { message: "No products matched." }
                ),
              },
            ],
          }
        );

        data = await callAnthropic(apiKey, anthropicMessages);
      }
    }

    const textBlock = (data.content as Array<{ type: string; text?: string }>)?.find((b) => b.type === "text");

    if (!textBlock?.text) {
      return NextResponse.json({ error: "No response from model" }, { status: 502 });
    }

    return NextResponse.json({ reply: textBlock.text, products: recommended });
  } catch (err) {
    console.error("lawn-assistant route error:", err);
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
  }
}
