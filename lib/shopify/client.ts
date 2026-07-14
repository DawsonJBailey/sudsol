export const SHOPIFY_API_VERSION = "2026-01";

const DOMAIN = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN;
const STOREFRONT_TOKEN = process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN;

type StorefrontFetchOptions = {
  query: string;
  variables?: Record<string, unknown>;
  /** Next.js ISR window in seconds; false = never cache (cart mutations). Ignored in the browser. */
  revalidate?: number | false;
  tags?: string[];
};

/**
 * Minimal Storefront API client. Runs in server components (with Next cache
 * options) and in the browser (cart operations) — the token is a public
 * storefront token, safe to expose client-side.
 */
export async function storefrontFetch<T>({
  query,
  variables,
  revalidate = 300,
  tags = ["shopify"],
}: StorefrontFetchOptions): Promise<T> {
  if (!DOMAIN || !STOREFRONT_TOKEN || STOREFRONT_TOKEN.startsWith("REPLACE_WITH")) {
    throw new Error(
      "Shopify is not configured. Set NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN and NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN in .env.local."
    );
  }

  const res = await fetch(`https://${DOMAIN}/api/${SHOPIFY_API_VERSION}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": STOREFRONT_TOKEN,
    },
    body: JSON.stringify({ query, variables }),
    ...(revalidate === false ? { cache: "no-store" as const } : { next: { revalidate, tags } }),
  });

  if (!res.ok) {
    throw new Error(`Storefront API HTTP ${res.status}: ${await res.text()}`);
  }

  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) {
    throw new Error(`Storefront API errors: ${json.errors.map((e) => e.message).join("; ")}`);
  }
  return json.data as T;
}
