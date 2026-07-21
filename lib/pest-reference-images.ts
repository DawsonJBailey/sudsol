import { readFileSync } from "fs";
import path from "path";
import { pests } from "./pests";
import { SUPPORTED_IMAGE_MEDIA_TYPES, sniffImageMediaType, type SupportedImageMediaType } from "./image";

export type PestReferenceImage = {
  slug: string;
  name: string;
  alt: string;
  mediaType: SupportedImageMediaType;
  data: string; // base64
};

type CacheControl = { type: "ephemeral" };

// An Anthropic content block: either a text label or a base64 image. An optional
// cache_control marks a prompt-cache breakpoint.
type ContentBlock =
  | { type: "text"; text: string; cache_control?: CacheControl }
  | {
      type: "image";
      source: { type: "base64"; media_type: string; data: string };
      cache_control?: CacheControl;
    };

// Load each pest's damage-pattern reference photo from public/pest-examples/ once
// at module init (the routes run on the Node runtime, so this reads real files on
// disk). We sniff the actual bytes rather than trusting the extension, since a
// file saved as .jpg may really be WebP/PNG. Anything missing or in an
// unsupported format is skipped with a warning rather than crashing the route.
function loadReferenceImages(): PestReferenceImage[] {
  const dir = path.join(process.cwd(), "public", "pest-examples");
  const loaded: PestReferenceImage[] = [];

  for (const pest of pests) {
    if (!pest.damageExample) continue;
    try {
      const buffer = readFileSync(path.join(dir, pest.damageExample.file));
      const mediaType = sniffImageMediaType(buffer);
      if (!mediaType || !SUPPORTED_IMAGE_MEDIA_TYPES.includes(mediaType)) {
        console.warn(`pest-reference-images: unsupported format for ${pest.slug}, skipping`);
        continue;
      }
      loaded.push({
        slug: pest.slug,
        name: pest.name,
        alt: pest.damageExample.alt,
        mediaType,
        data: buffer.toString("base64"),
      });
    } catch (err) {
      console.warn(`pest-reference-images: could not load reference for ${pest.slug}`, err);
    }
  }

  return loaded;
}

export const pestReferenceImages: PestReferenceImage[] = loadReferenceImages();

// Build the labeled few-shot reference blocks to prepend before a customer's
// photo: an intro line, then for each pest a caption followed by its example
// image. Returns an empty array if no references loaded, so callers degrade
// gracefully to the previous zero-shot behavior.
export function buildReferenceContentBlocks(): ContentBlock[] {
  if (pestReferenceImages.length === 0) return [];

  const blocks: ContentBlock[] = [
    {
      type: "text",
      text:
        "Below are reference photos showing how each known lawn pest typically damages turf. " +
        "Study them, then use them as visual examples when judging the customer's photo that follows. " +
        "Match on the overall damage pattern, not just color — several of these look like drought stress.",
    },
  ];

  for (const ref of pestReferenceImages) {
    blocks.push({ type: "text", text: `Reference — ${ref.name} (slug: ${ref.slug}): ${ref.alt}` });
    blocks.push({
      type: "image",
      source: { type: "base64", media_type: ref.mediaType, data: ref.data },
    });
  }

  // Prompt-cache breakpoint on the last reference block. These blocks are
  // byte-identical on every request and get re-sent on each tool-loop round and
  // follow-up turn, so caching them lets Anthropic reuse the (~11k image tokens)
  // prefix instead of reprocessing it each time.
  const last = blocks[blocks.length - 1];
  if (last) last.cache_control = { type: "ephemeral" };

  return blocks;
}
