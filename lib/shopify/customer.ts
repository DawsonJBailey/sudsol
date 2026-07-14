import "server-only";
import { cookies } from "next/headers";

/**
 * Shopify Customer Account API auth (public client + PKCE).
 *
 * Tokens live in httpOnly cookies and never reach the browser. OAuth
 * endpoints are discovered from the store's OpenID configuration rather than
 * hardcoded, per Shopify's guidance.
 */

const DOMAIN = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN;
const CLIENT_ID = process.env.SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID;

export const AUTH_COOKIES = {
  accessToken: "sfc_access",
  refreshToken: "sfc_refresh",
  idToken: "sfc_id",
  // Short-lived cookies used only during the OAuth round trip.
  state: "sfc_state",
  verifier: "sfc_verifier",
  nonce: "sfc_nonce",
} as const;

export const SCOPES = "openid email customer-account-api:full";

type OpenIdConfig = {
  authorization_endpoint: string;
  token_endpoint: string;
  end_session_endpoint: string;
};

type CustomerApiConfig = { graphql_api: string };

let openIdConfig: OpenIdConfig | null = null;
let customerApiConfig: CustomerApiConfig | null = null;

function requireEnv(): { domain: string; clientId: string } {
  if (!DOMAIN || !CLIENT_ID) {
    throw new Error(
      "Customer Account API is not configured. Set NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN and SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID."
    );
  }
  return { domain: DOMAIN, clientId: CLIENT_ID };
}

export async function getOpenIdConfig(): Promise<OpenIdConfig> {
  if (openIdConfig) return openIdConfig;
  const { domain } = requireEnv();
  const res = await fetch(`https://${domain}/.well-known/openid-configuration`, {
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`OpenID discovery failed: HTTP ${res.status}`);
  openIdConfig = (await res.json()) as OpenIdConfig;
  return openIdConfig;
}

async function getCustomerApiConfig(): Promise<CustomerApiConfig> {
  if (customerApiConfig) return customerApiConfig;
  const { domain } = requireEnv();
  const res = await fetch(`https://${domain}/.well-known/customer-account-api`, {
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`Customer API discovery failed: HTTP ${res.status}`);
  customerApiConfig = (await res.json()) as CustomerApiConfig;
  return customerApiConfig;
}

// ---------------------------------------------------------------------------
// PKCE helpers (Web Crypto, available in the Node.js runtime Next.js uses)
// ---------------------------------------------------------------------------

function base64UrlEncode(bytes: Uint8Array): string {
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function randomToken(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return base64UrlEncode(buf);
}

export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64UrlEncode(new Uint8Array(digest));
}

// ---------------------------------------------------------------------------
// Token exchange + session
// ---------------------------------------------------------------------------

export type TokenResponse = {
  access_token: string;
  refresh_token: string;
  id_token?: string;
  expires_in: number;
};

export async function exchangeCodeForTokens(
  code: string,
  verifier: string,
  redirectUri: string
): Promise<TokenResponse> {
  const { clientId } = requireEnv();
  const { token_endpoint } = await getOpenIdConfig();
  const res = await fetch(token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      code,
      redirect_uri: redirectUri,
      code_verifier: verifier,
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Token exchange failed (HTTP ${res.status}): ${await res.text()}`);
  }
  return (await res.json()) as TokenResponse;
}

async function refreshTokens(refreshToken: string): Promise<TokenResponse | null> {
  const { clientId } = requireEnv();
  const { token_endpoint } = await getOpenIdConfig();
  const res = await fetch(token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      refresh_token: refreshToken,
    }),
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as TokenResponse;
}

export type CustomerSession = {
  accessToken: string;
  /** Set when tokens were refreshed during this call; caller must persist. */
  refreshed?: TokenResponse;
};

/**
 * Returns the current customer session, refreshing the access token if it
 * has expired. Route handlers / server actions should persist `refreshed`
 * tokens via `sessionCookieValues()`; server components can pass the session
 * along but cannot write cookies (Next.js restriction) — the next route-handler
 * request will persist the refresh instead.
 */
export async function getCustomerSession(): Promise<CustomerSession | null> {
  const store = await cookies();
  const access = store.get(AUTH_COOKIES.accessToken)?.value;
  if (access) return { accessToken: access };

  const refresh = store.get(AUTH_COOKIES.refreshToken)?.value;
  if (!refresh) return null;

  const tokens = await refreshTokens(refresh);
  if (!tokens) return null;
  return { accessToken: tokens.access_token, refreshed: tokens };
}

/** Cookie payloads for a token set; caller applies them via cookies().set. */
export function sessionCookieValues(tokens: TokenResponse) {
  const base = { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" };
  return [
    {
      name: AUTH_COOKIES.accessToken,
      value: tokens.access_token,
      // Expire the cookie slightly before the token so we never send a dead one.
      options: { ...base, maxAge: Math.max(tokens.expires_in - 60, 60) },
    },
    {
      name: AUTH_COOKIES.refreshToken,
      value: tokens.refresh_token,
      options: { ...base, maxAge: 60 * 60 * 24 * 30 },
    },
    ...(tokens.id_token
      ? [
          {
            name: AUTH_COOKIES.idToken,
            value: tokens.id_token,
            options: { ...base, maxAge: 60 * 60 * 24 * 30 },
          },
        ]
      : []),
  ];
}

// ---------------------------------------------------------------------------
// Customer Account API GraphQL
// ---------------------------------------------------------------------------

export async function customerFetch<T>(
  accessToken: string,
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const { graphql_api } = await getCustomerApiConfig();
  const res = await fetch(graphql_api, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: accessToken,
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Customer Account API HTTP ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) {
    throw new Error(`Customer Account API errors: ${json.errors.map((e) => e.message).join("; ")}`);
  }
  return json.data as T;
}

export type CustomerProfile = {
  firstName: string | null;
  lastName: string | null;
  emailAddress: { emailAddress: string } | null;
};

export type CustomerOrder = {
  id: string;
  /** Shopify order name, e.g. "#1001". */
  name: string;
  processedAt: string;
  financialStatus: string;
  total: number;
  items: { key: string; name: string; quantity: number; lineTotal: number }[];
};

export async function getCustomerOrders(accessToken: string): Promise<CustomerOrder[]> {
  const data = await customerFetch<{
    customer: {
      orders: {
        nodes: {
          id: string;
          name: string;
          processedAt: string;
          financialStatus: string | null;
          totalPrice: { amount: string };
          lineItems: {
            nodes: { id: string; name: string; quantity: number; price: { amount: string } | null }[];
          };
        }[];
      };
    };
  }>(
    accessToken,
    /* GraphQL */ `
      query CustomerOrders {
        customer {
          orders(first: 50, sortKey: PROCESSED_AT, reverse: true) {
            nodes {
              id
              name
              processedAt
              financialStatus
              totalPrice {
                amount
              }
              lineItems(first: 50) {
                nodes {
                  id
                  name
                  quantity
                  price {
                    amount
                  }
                }
              }
            }
          }
        }
      }
    `
  );

  return data.customer.orders.nodes.map((order) => ({
    id: order.id,
    name: order.name,
    processedAt: order.processedAt,
    financialStatus: (order.financialStatus ?? "PAID").toLowerCase().replace(/_/g, " "),
    total: Number(order.totalPrice.amount),
    items: order.lineItems.nodes.map((item) => ({
      key: item.id,
      name: item.name,
      quantity: item.quantity,
      lineTotal: item.price ? Number(item.price.amount) * item.quantity : 0,
    })),
  }));
}

export async function getCustomerProfile(accessToken: string): Promise<CustomerProfile> {
  const data = await customerFetch<{ customer: CustomerProfile }>(
    accessToken,
    /* GraphQL */ `
      query CustomerProfile {
        customer {
          firstName
          lastName
          emailAddress {
            emailAddress
          }
        }
      }
    `
  );
  return data.customer;
}
