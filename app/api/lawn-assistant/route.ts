import { NextRequest, NextResponse } from "next/server";
import { recommendProducts, type LawnPreferences } from "@/lib/data";
import {
  getProducts,
  getControlProducts,
  type CatalogProduct,
  type ControlCatalogProduct,
} from "@/lib/shopify/catalog";
import { pests } from "@/lib/pests";
import { SUPPORTED_IMAGE_MEDIA_TYPES, sniffImageMediaType } from "@/lib/image";
import { buildReferenceContentBlocks } from "@/lib/pest-reference-images";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { PREFERENCE_QUESTIONS, type PreferenceQuestion } from "@/lib/preferences";

// Per-IP limit for the chat endpoint: enough for a real conversation, tight
// enough that a bot hammering the endpoint gets cut off quickly.
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 5 * 60 * 1000;

export const runtime = "nodejs";

type ChatContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; mediaType: string; data: string };

type ChatMessage = { role: "user" | "assistant"; content: string | ChatContentBlock[] };

// Full field guide, not just slug:name — the model needs each pest's
// identification and damage-sign criteria to tell look-alikes apart.
const pestGuide = pests
  .map((p) => `- ${p.slug} (${p.name}): ${p.identification} Damage signs: ${p.damageSigns}`)
  .join("\n");

const SYSTEM_PROMPT = `You are the Meridian Turf lawn care assistant, embedded as a chat widget on our storefront.

You have two jobs:

1. Help visitors pick the right sod, seed, or plug product. To recommend well you need four things:
- sun: full sun or shade
- traffic: high or low foot traffic
- maintenance: low-maintenance or best-looking
- goal: a brand-new lawn or patching bare spots
- timeline (optional, and the deciding factor for sod vs seed): wanting a finished lawn right away means sod — it installs as an established lawn. Being happy to wait a few weeks means seed, which costs less but takes weeks to fill in. Plugs sit in between. When the visitor gives a timeline, honor it when choosing which slugs to pass to show_products, and say a word about the tradeoff in your reply.
Gather these with the ask_preferences tool: call it with EVERY preference you don't yet know, and the visitor is shown tappable answer buttons for each one (including a "Not sure" option). Call it in your very first reply with all four unless the visitor already told you some. Never ask about sun, traffic, maintenance, or goal in prose — the buttons do the asking; your accompanying text must be only a short, friendly lead-in like "Happy to help! A few quick questions:" with no questions or options written out.
Visitors may answer by tapping (their reply reads like "Full sun. Not sure about traffic.") or by typing freely. Treat any "not sure" as no preference: recommend without that filter and do NOT re-ask it. If some preferences are still unknown after their reply, call ask_preferences again with just those. If a visitor mentions their location, climate, ZIP code, hardiness zone, or region, acknowledge it in a word and move on.
Once every preference is answered or marked not-sure (or the visitor doesn't want to give more), call the recommend_products tool to fetch the real matches, then call the show_products tool with the 2-3 slugs you want to surface. Never recommend a product to the visitor without calling show_products.

2. If a visitor attaches a photo of an insect or lawn damage, help identify which of these known lawn pests it is:
${pestGuide}

When a photo is attached you'll also be given labeled reference photos of each pest's typical turf damage. Work like a careful turf expert:
- FIRST, AND MOST IMPORTANT: if an actual insect, larva, grub, or caterpillar is visible in the photo, identify it from the creature itself and call identify_pest right away. Do NOT ask diagnostic checks in this case — the checks exist only for when no insect is visible. A visible specimen is far stronger evidence than any damage-pattern question, so don't stall on it. Use these features to tell the look-alike larvae apart:
   • Sod webworm larva: small (roughly 3/4 inch), pale green-brown to tan, with rows of small dark spots along the body; often curled in the thatch or in a silk-lined tunnel.
   • Fall armyworm larva: noticeably larger (30-40mm), with a pale inverted "Y" on a dark head capsule and bold lengthwise stripes.
   • White grub: C-shaped, cream/white, brown head, six visible front legs, found in soil.
   • Mole cricket: over an inch, shovel-like front legs. Chinch bug: tiny, dark, white band across the back. Billbug: weevil with a long curved snout. Spittlebug: small dark insect, often with froth.
  Also identify from an unmistakable sign even without the insect — mole cricket tunnels and soil mounds, or spittlebug froth. Judge by the pest or its telltale sign itself, NOT by whether the plant in the photo is grass: identify it the same way even when it appears on a weed, ornamental, or other plant near the lawn. These pests move onto turf, so the identification is still useful.
- ONLY when no insect, larva, or unmistakable sign is visible anywhere in the photo: many of these pests produce similar-looking damage in a wide lawn shot — especially the irregular brown, drought-like patches shared by chinch bugs, hunting billbugs, white grubs, fall armyworms, and sometimes mole crickets. In that damage-only case, do NOT guess a single pest. Instead, call the ask_pest_checks tool with the diagnostic checks that would distinguish the candidates you're weighing — the visitor sees each as a tappable Yes / No / Not sure question. What each check points to when the answer is yes:
   • carpet-peel → white grubs
   • tug-test → hunting billbugs
   • hot-edges → chinch bugs
   • sudden-spread → fall armyworms (skeletonized + gradual instead → sod webworms)
   • tunnels → mole crickets
   • skeletonized → sod webworms or fall armyworms (use sudden-spread to split them)
   • froth → spittlebugs
   Only narrow the check list when the photo genuinely rules pests out (e.g. you can clearly see skeletonized blades and just need sudden-spread to split webworms from armyworms — ask 1-2 checks). Otherwise ask ALL the checks: a wide shot of brown, dying, or torn-up turf can NOT rule out mole crickets, spittlebugs, or sod webworms — their damage looks like generic patchiness from a distance too, and tunnels, froth, or skeletonizing are exactly the ground-level details a visitor can see that the photo doesn't show. Never write these checks out as prose questions — the buttons do that. Your text should briefly name the likely culprits and invite them to answer the quick checks below, mentioning that a close-up photo of any insect they can find also works. Their reply may be tapped answers (reading like "Yes — the dead patches peel back easily like a loose carpet. No — the grass resists when tugged.") or typed free text. Interpret the answers: a clear yes on a check points to its pest — call identify_pest with that slug and give the treatment. If several checks come back yes, weigh them together with the photo and pick the best-supported pest, or ask one brief clarifying question. If the answers are all no / not-sure, or conflicting, say you can't confirm from this alone and ask for a close-up photo of any insect in the affected area.
- A photo or conversation can reveal MORE THAN ONE pest (separate problem areas, or two kinds of damage side by side). Identify every pest you're confident about: call identify_pest once per pest slug, in the same turn — each identified pest's treatment appears as its own card, so identifying only one of two pests loses the other's treatment.
- Only when the photo matches none of these known pests or their signs at all, call identify_pest with "unknown". Do not answer "unknown" just because the pest or sign is on a non-grass plant.

You may refer to the known pests above by name when explaining possibilities or asking a narrowing question. But never give a definitive identification until identify_pest has returned, and never invent or recall product facts from memory. If a tool returns no match, say so plainly rather than making something up.

PRESENTATION — the products you pick with show_products, and the pest treatment from identify_pest, appear as interactive cards right below your message, each with the product photo, price, and an Add to Cart button. In your reply, DO explain your recommendations like a knowledgeable person talking a friend through it: in a few natural sentences, tell the visitor why these particular picks suit what they told you — connect them to their sun, traffic, upkeep, and goal — and mention the products by name conversationally. What you must NOT do is format this as a product catalog: no "**Product Name** — description" bullet lists, and don't recite prices or spec sheets, since the cards already show those. For a pest, name it, note the damage briefly, and mention that the treatment shown will handle it. Keep it warm and concise.

Never mention how you work internally — don't explain what data you do or don't use, what you "factor in" or "consider," how recommendations are generated, or any other limitation or mechanism behind the scenes. Just help the visitor naturally, as a knowledgeable lawn care person would, without narrating your own process.`;

// Diagnostic checks that distinguish the look-alike "drought-stress patch"
// pests. Same rendering path as the preference questions: the model picks WHICH
// checks to ask, the wording/options are fixed here, and each tapped option
// composes into an unambiguous plain-text visitor reply.
const PEST_CHECK_QUESTIONS: Record<string, PreferenceQuestion> = {
  "carpet-peel": {
    key: "carpet-peel",
    question: "Do the dead patches peel or lift back easily, like a loose carpet?",
    options: [
      { label: "Yes", value: "Yes — the dead patches peel back easily like a loose carpet" },
      { label: "No", value: "No — the dead patches don't peel back like carpet" },
      { label: "Not sure", value: "Not sure about the carpet-peel check" },
    ],
  },
  "tug-test": {
    key: "tug-test",
    question: "When you tug a handful of brown grass, does it pull out with little or no root resistance?",
    options: [
      { label: "Yes", value: "Yes — tugged grass pulls out with little or no root resistance" },
      { label: "No", value: "No — the grass resists when tugged" },
      { label: "Not sure", value: "Not sure about the tug test" },
    ],
  },
  "hot-edges": {
    key: "hot-edges",
    question: "Are the worst patches along hot, dry edges like sidewalks or driveways?",
    options: [
      { label: "Yes", value: "Yes — damage is worst along hot, dry edges like sidewalks and driveways" },
      { label: "No", value: "No — the damage isn't concentrated along hot, dry edges" },
      { label: "Not sure", value: "Not sure whether damage is worse near edges" },
    ],
  },
  "sudden-spread": {
    key: "sudden-spread",
    question: "Did the damage appear suddenly and spread across the lawn within days?",
    options: [
      { label: "Yes", value: "Yes — the damage appeared suddenly and spread within days" },
      { label: "No", value: "No — the damage developed gradually" },
      { label: "Not sure", value: "Not sure how quickly the damage spread" },
    ],
  },
  tunnels: {
    key: "tunnels",
    question: "Do you see raised, spongy tunnel tracks or small mounds of loose soil?",
    options: [
      { label: "Yes", value: "Yes — there are raised, spongy tunnel tracks or small soil mounds" },
      { label: "No", value: "No — no tunnel tracks or soil mounds" },
      { label: "Not sure", value: "Not sure about tunnels or soil mounds" },
    ],
  },
  froth: {
    key: "froth",
    question: "Is there frothy, spit-like foam down in the grass or thatch?",
    options: [
      { label: "Yes", value: "Yes — there's frothy, spit-like foam in the grass" },
      { label: "No", value: "No — no frothy foam anywhere" },
      { label: "Not sure", value: "Not sure about frothy foam" },
    ],
  },
  skeletonized: {
    key: "skeletonized",
    question: "Do individual grass blades look chewed thin or see-through (skeletonized)?",
    options: [
      { label: "Yes", value: "Yes — blades look chewed thin and see-through" },
      { label: "No", value: "No — the blades aren't skeletonized" },
      { label: "Not sure", value: "Not sure whether blades are skeletonized" },
    ],
  },
};

const ASK_PEST_CHECKS_TOOL = {
  name: "ask_pest_checks",
  description:
    "Show the visitor tappable Yes / No / Not sure buttons for the diagnostic checks that distinguish look-alike pest damage. Always use this instead of writing the checks out as prose questions. Your accompanying text should name the likely pests and invite the visitor to answer the quick checks (or send a close-up insect photo) — never restate the check questions in words.",
  input_schema: {
    type: "object" as const,
    properties: {
      checks: {
        type: "array",
        items: { type: "string", enum: Object.keys(PEST_CHECK_QUESTIONS) },
        description: "Which diagnostic checks to show — include every check that would help distinguish the candidates.",
      },
    },
    required: ["checks"],
  },
};

const ASK_PREFERENCES_TOOL = {
  name: "ask_preferences",
  description:
    "Show the visitor tappable answer buttons for the lawn preferences you still need. Always use this instead of asking about sun, traffic, maintenance, or goal in prose. Your accompanying text should be only a brief friendly lead-in — never restate the questions or options in words.",
  input_schema: {
    type: "object" as const,
    properties: {
      questions: {
        type: "array",
        items: { type: "string", enum: Object.keys(PREFERENCE_QUESTIONS) },
        description: "Which preferences to ask about — include every one you don't yet know.",
      },
    },
    required: ["questions"],
  },
};

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

const SHOW_PRODUCTS_TOOL = {
  name: "show_products",
  description:
    "Choose which of the products returned by recommend_products to show the visitor as interactive cards (usually 2-3). Call this after recommend_products and before recommending anything in your reply.",
  input_schema: {
    type: "object" as const,
    properties: {
      slugs: {
        type: "array",
        items: { type: "string" },
        description: "Slugs to display, chosen from the recommend_products results.",
      },
    },
    required: ["slugs"],
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
      max_tokens: 1024,
      // cache_control on the system block also caches the tools (they render
      // first), so this whole static prefix is reused across every request.
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      tools: [
        ASK_PREFERENCES_TOOL,
        ASK_PEST_CHECKS_TOOL,
        RECOMMEND_PRODUCTS_TOOL,
        SHOW_PRODUCTS_TOOL,
        IDENTIFY_PEST_TOOL,
      ],
      messages,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("Anthropic API error:", errText);
    throw new Error("AI request failed");
  }

  const data = await response.json();
  const usage = data.usage ?? {};
  console.log(
    `lawn-assistant cache: read=${usage.cache_read_input_tokens ?? 0} write=${usage.cache_creation_input_tokens ?? 0} uncached=${usage.input_tokens ?? 0}`
  );
  return data;
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
    const rate = checkRateLimit("lawn-assistant", getClientIp(req), RATE_LIMIT, RATE_WINDOW_MS);
    if (!rate.ok) {
      return NextResponse.json(
        { error: "You're sending messages too quickly. Give it a minute and try again." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
      );
    }

    const { messages } = (await req.json()) as { messages: ChatMessage[] };

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Missing messages" }, { status: 400 });
    }

    // Payload caps: the widget never produces conversations or images this
    // large, so anything over these lines is a direct-to-API abuser.
    if (messages.length > 40) {
      return NextResponse.json({ error: "Conversation too long." }, { status: 400 });
    }
    const MAX_IMAGE_BASE64 = 8 * 1024 * 1024; // ~6MB decoded
    for (const m of messages) {
      if (Array.isArray(m.content)) {
        for (const block of m.content) {
          if (block.type === "image" && block.data.length > MAX_IMAGE_BASE64) {
            return NextResponse.json({ error: "Image too large." }, { status: 400 });
          }
        }
      }
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Server is missing ANTHROPIC_API_KEY. Add it to .env.local." },
        { status: 500 }
      );
    }

    let anthropicMessages: Array<{ role: string; content: unknown }>;
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

    // When the visitor has attached a photo, prepend the labeled pest damage
    // reference images right before that photo so the model classifies few-shot.
    // The references must go on the user turn holding the image — image blocks
    // aren't allowed in assistant turns (e.g. the greeting). Skipped for
    // text-only chats to avoid the extra image payload.
    const referenceBlocks = buildReferenceContentBlocks();
    if (referenceBlocks.length > 0) {
      const imageTurn = anthropicMessages.find(
        (m) =>
          m.role === "user" &&
          Array.isArray(m.content) &&
          m.content.some((b) => (b as { type?: string }).type === "image")
      );
      if (imageTurn) {
        imageTurn.content = [...referenceBlocks, ...(imageTurn.content as unknown[])];
      }
    }

    let data = await callAnthropic(apiKey, anthropicMessages);
    let recommended: ReturnType<typeof recommendProducts> = [];
    // The subset the model chose to surface — this becomes the visitor's cards.
    let presented: CatalogProduct[] = [];
    // Preference questions the model asked this turn, rendered by the widget
    // as tappable answer buttons.
    let askedQuestions: PreferenceQuestion[] = [];
    // A photo can show more than one pest — the model calls identify_pest once
    // per slug, and each identification accumulates here. Treatments are
    // deduped since several pests share a control product.
    const identifiedPests: (typeof pests)[number][] = [];
    const treatmentProducts: ControlCatalogProduct[] = [];

    for (let round = 0; data.stop_reason === "tool_use" && round < MAX_TOOL_ROUNDS; round++) {
      const toolUseBlocks = (
        data.content as Array<{ type: string; id: string; name: string; input: Record<string, unknown> }>
      ).filter((b) => b.type === "tool_use");

      if (toolUseBlocks.length === 0) break;

      const toolResults = await Promise.all(toolUseBlocks.map(async (block) => {
        if (block.name === "ask_preferences" || block.name === "ask_pest_checks") {
          const defs = block.name === "ask_preferences" ? PREFERENCE_QUESTIONS : PEST_CHECK_QUESTIONS;
          let keys = (block.input?.questions ?? block.input?.checks ?? []) as string[];
          // Backstop: asking 3+ pest checks signals broad uncertainty (not a
          // targeted split between two candidates). In that case the model can't
          // have truly ruled out the distinctive-sign pests either, so show the
          // full check set — otherwise a mole cricket/spittlebug/webworm case
          // has no button that can ever reach the right answer.
          if (block.name === "ask_pest_checks" && keys.length >= 3) {
            keys = Object.keys(PEST_CHECK_QUESTIONS);
          }
          // Map to the fixed definitions, dropping unknowns and duplicates,
          // merging with any questions already asked this turn.
          const mapped = [...new Set(keys)].flatMap((k) => {
            const q = defs[k];
            return q && !askedQuestions.some((a) => a.key === q.key) ? [q] : [];
          });
          askedQuestions = [...askedQuestions, ...mapped];
          return {
            type: "tool_result" as const,
            tool_use_id: block.id,
            content: JSON.stringify({
              displayed: mapped.map((q) => q.key),
              note: "Answer buttons are now shown to the visitor. Reply with only a brief friendly lead-in.",
            }),
          };
        }

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

        if (block.name === "show_products") {
          const catalog = await getProducts();
          const slugs = (block.input?.slugs ?? []) as string[];
          // Match each chosen slug back to the real catalog product, dropping any
          // slug the model invented.
          presented = slugs.flatMap((slug) => {
            const product = catalog.find((c) => c.slug === slug);
            return product ? [product] : [];
          });
          return {
            type: "tool_result" as const,
            tool_use_id: block.id,
            content: JSON.stringify({ shown: presented.map((p) => p.slug) }),
          };
        }

        if (block.name === "identify_pest") {
          const pestSlug = block.input?.pestSlug as string | undefined;
          const pest = pests.find((p) => p.slug === pestSlug) ?? null;
          // Pull the treatment from Shopify (not the static fixture) so the
          // client gets the variant id + product image its Add to Cart card needs.
          let product: ControlCatalogProduct | null = null;
          if (pest) {
            if (!identifiedPests.some((p) => p.slug === pest.slug)) identifiedPests.push(pest);
            const controls = await getControlProducts();
            product = controls.find((c) => c.slug === pest.controlSlug) ?? null;
            if (product && !treatmentProducts.some((c) => c.slug === product?.slug)) {
              treatmentProducts.push(product);
            }
          }

          return {
            type: "tool_result" as const,
            tool_use_id: block.id,
            content: pest
              ? JSON.stringify({
                  pest: { slug: pest.slug, name: pest.name, damageSigns: pest.damageSigns },
                  treatment: product
                    ? {
                        name: product.name,
                        activeIngredient: product.activeIngredient,
                        price: product.price,
                        description: product.description,
                      }
                    : null,
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
    let reply = textBlock?.text?.trim();

    if (!reply) {
      // The model ended its turn without any prose (e.g. it emitted only a tool
      // call, or the output was truncated). Never dead-end the visitor: if a tool
      // already gave us grounded data, answer from that; otherwise ask them to
      // retry. All facts below come from our own catalog/pest data, so this stays
      // within the same grounding rules as a normal tool-backed reply.
      console.warn("lawn-assistant: final model turn had no text", {
        stop_reason: data.stop_reason,
        blocks: (data.content as Array<{ type: string }>)?.map((b) => b.type),
      });

      if (identifiedPests.length > 0) {
        const names = identifiedPests.map((p) => p.name).join(" and ");
        reply =
          treatmentProducts.length > 0
            ? `That looks like ${names}. The treatment${treatmentProducts.length > 1 ? "s" : ""} below will take care of it:`
            : `That looks like ${names}.`;
      } else if (presented.length > 0 || recommended.length > 0) {
        reply = "Here are a few options that fit what you described:";
      } else if (askedQuestions.length > 0) {
        reply = "A few quick questions to help narrow it down:";
      } else {
        reply =
          "Sorry — I didn't quite catch that. Could you rephrase, or attach a photo and I'll take a look?";
      }
    }

    return NextResponse.json({
      // Prefer the model's curated, reasoned selection; fall back to the raw
      // matches if it recommended without calling show_products.
      reply,
      products: presented.length > 0 ? presented : recommended,
      questions: askedQuestions,
      pests: identifiedPests,
      controlProducts: treatmentProducts,
    });
  } catch (err) {
    console.error("lawn-assistant route error:", err);
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
  }
}
