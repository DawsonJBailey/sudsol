import "server-only";
import { SHOPIFY_API_VERSION } from "./client";

const DOMAIN = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN;
const CLIENT_ID = process.env.SHOPIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET;

// Client-credentials Admin tokens live 24h; cache per server instance and
// re-mint shortly before expiry.
let cached: { token: string; expiresAt: number } | null = null;

async function getAdminToken(): Promise<string> {
  if (cached && Date.now() < cached.expiresAt - 60_000) {
    return cached.token;
  }

  if (!DOMAIN || !CLIENT_ID || !CLIENT_SECRET) {
    throw new Error(
      "Shopify Admin API is not configured. Set NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN, SHOPIFY_CLIENT_ID, and SHOPIFY_CLIENT_SECRET."
    );
  }

  const res = await fetch(`https://${DOMAIN}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Admin token exchange failed (HTTP ${res.status}): ${await res.text()}`);
  }

  const json = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return cached.token;
}

export async function adminFetch<T>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const token = await getAdminToken();
  const res = await fetch(`https://${DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": token,
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Admin API HTTP ${res.status}: ${await res.text()}`);
  }

  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) {
    throw new Error(`Admin API errors: ${json.errors.map((e) => e.message).join("; ")}`);
  }
  return json.data as T;
}
