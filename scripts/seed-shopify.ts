/**
 * Seeds the Shopify test store from the local catalog fixture in lib/data.ts.
 *
 * Idempotent: products are matched by handle (= our slug) and updated in
 * place; metafield definitions that already exist are left alone. Safe to
 * re-run after editing lib/data.ts.
 *
 * Usage: npm run seed:shopify
 * Requires NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN, SHOPIFY_CLIENT_ID, and
 * SHOPIFY_CLIENT_SECRET in .env.local. The script exchanges the client
 * credentials for a 24h Admin API token (client credentials grant — the only
 * token mechanism for Dev Dashboard apps since Jan 2026).
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { products, type Product } from "../lib/data";
import { controlProducts, type ControlProduct } from "../lib/pests";

const DOMAIN = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN;
const CLIENT_ID = process.env.SHOPIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET;
const API_VERSION = "2026-01";

if (!DOMAIN || !CLIENT_ID || !CLIENT_SECRET || CLIENT_SECRET.startsWith("REPLACE_WITH")) {
  console.error(
    "Missing Shopify credentials. Set NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN, SHOPIFY_CLIENT_ID, and SHOPIFY_CLIENT_SECRET in .env.local."
  );
  process.exit(1);
}

const ENDPOINT = `https://${DOMAIN}/admin/api/${API_VERSION}/graphql.json`;
const REQUIRED_SCOPES = ["write_products", "read_publications", "write_publications"];

let adminToken = "";

async function fetchAdminToken(): Promise<void> {
  const res = await fetch(`https://${DOMAIN}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: CLIENT_ID!,
      client_secret: CLIENT_SECRET!,
    }),
  });

  if (!res.ok) {
    throw new Error(
      `Client credentials exchange failed (HTTP ${res.status}): ${await res.text()}\n` +
        "Check that the Dev Dashboard app is installed on this store and the client secret is correct."
    );
  }

  const json = (await res.json()) as { access_token: string; scope: string };
  adminToken = json.access_token;

  const granted = json.scope.split(",").map((s) => s.trim());
  const missing = REQUIRED_SCOPES.filter(
    // write_* implies its read_* counterpart.
    (s) => !granted.includes(s) && !granted.includes(s.replace(/^read_/, "write_"))
  );
  if (missing.length > 0) {
    throw new Error(
      `Admin token is missing scopes: ${missing.join(", ")} (granted: ${json.scope}).\n` +
        "Add them in the Dev Dashboard: app → Access → Admin API access scopes, then re-run."
    );
  }
  console.log(`Admin token acquired (scopes: ${json.scope})\n`);
}

const STOREFRONT_TOKEN_TITLE = "meridian-headless-storefront";

/**
 * The Headless channel isn't available on this store's plan, so we mint a
 * classic Storefront API access token via the Admin API instead and write it
 * into .env.local for the app to use.
 */
async function ensureStorefrontToken(): Promise<void> {
  const current = process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN;
  if (current && !current.startsWith("REPLACE_WITH")) {
    return;
  }

  let token: string | null = null;

  // Reuse the token from a previous run if one exists.
  try {
    const data = await adminFetch<{
      shop: { storefrontAccessTokens: { nodes: { accessToken: string; title: string }[] } };
    }>(/* GraphQL */ `
      query GetStorefrontTokens {
        shop {
          storefrontAccessTokens(first: 100) {
            nodes { accessToken title }
          }
        }
      }
    `);
    token =
      data.shop.storefrontAccessTokens.nodes.find((t) => t.title === STOREFRONT_TOKEN_TITLE)
        ?.accessToken ?? null;
  } catch {
    // Listing may not be available; fall through to creating a fresh token.
  }

  if (token) {
    console.log("Reusing existing storefront access token.");
  } else {
    const data = await adminFetch<{
      storefrontAccessTokenCreate: {
        storefrontAccessToken: { accessToken: string; accessScopes: { handle: string }[] } | null;
        userErrors: { message: string }[];
      };
    }>(
      /* GraphQL */ `
        mutation StorefrontTokenCreate($input: StorefrontAccessTokenInput!) {
          storefrontAccessTokenCreate(input: $input) {
            storefrontAccessToken { accessToken accessScopes { handle } }
            userErrors { message }
          }
        }
      `,
      { input: { title: STOREFRONT_TOKEN_TITLE } }
    );
    const payload = data.storefrontAccessTokenCreate;
    if (!payload.storefrontAccessToken || payload.userErrors.length > 0) {
      throw new Error(
        `storefrontAccessTokenCreate failed: ${payload.userErrors.map((e) => e.message).join("; ")}`
      );
    }
    token = payload.storefrontAccessToken.accessToken;
    console.log(
      `Storefront token created (scopes: ${payload.storefrontAccessToken.accessScopes
        .map((s) => s.handle)
        .join(", ")})`
    );
  }

  const envPath = resolve(process.cwd(), ".env.local");
  if (existsSync(envPath)) {
    const env = readFileSync(envPath, "utf8");
    if (env.includes("NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN=")) {
      writeFileSync(
        envPath,
        env.replace(
          /NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN=.*/,
          `NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN=${token}`
        )
      );
      console.log("Wrote storefront token to .env.local (restart `npm run dev` to pick it up)\n");
      return;
    }
  }
  console.log(`Add this to .env.local:\nNEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN=${token}\n`);
}

async function adminFetch<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": adminToken,
    },
    body: JSON.stringify({ query, variables }),
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

// ---------------------------------------------------------------------------
// Metafield definitions (namespace "meridian", product-level)
// ---------------------------------------------------------------------------

const NAMESPACE = "meridian";
const TOLERANCE_CHOICES = ["Fair", "Good", "Very Good", "Excellent"];

type MetafieldDef = {
  key: string;
  name: string;
  type: string;
  choices?: string[];
};

const METAFIELD_DEFINITIONS: MetafieldDef[] = [
  { key: "tagline", name: "Tagline", type: "single_line_text_field" },
  { key: "color", name: "Color", type: "single_line_text_field" },
  { key: "texture", name: "Texture", type: "single_line_text_field" },
  { key: "wear_tolerance", name: "Wear Tolerance", type: "single_line_text_field", choices: TOLERANCE_CHOICES },
  { key: "drought_tolerance", name: "Drought Tolerance", type: "single_line_text_field", choices: TOLERANCE_CHOICES },
  { key: "shade_tolerance", name: "Shade Tolerance", type: "single_line_text_field", choices: TOLERANCE_CHOICES },
  { key: "mow_height", name: "Mow Height", type: "single_line_text_field" },
  { key: "stages", name: "Growth Stages", type: "json" },
  { key: "maintenance", name: "Maintenance Level", type: "single_line_text_field", choices: ["low", "medium", "high"] },
  { key: "best_for", name: "Best For", type: "list.single_line_text_field", choices: ["new-lawn", "bare-spot-repair"] },
  { key: "active_ingredient", name: "Active Ingredient", type: "single_line_text_field" },
];

const METAFIELD_DEFINITION_CREATE = /* GraphQL */ `
  mutation MetafieldDefinitionCreate($definition: MetafieldDefinitionInput!) {
    metafieldDefinitionCreate(definition: $definition) {
      createdDefinition { id key }
      userErrors { field message code }
    }
  }
`;

async function ensureMetafieldDefinitions(): Promise<void> {
  for (const def of METAFIELD_DEFINITIONS) {
    const data = await adminFetch<{
      metafieldDefinitionCreate: {
        createdDefinition: { id: string } | null;
        userErrors: { message: string; code: string }[];
      };
    }>(METAFIELD_DEFINITION_CREATE, {
      definition: {
        name: def.name,
        namespace: NAMESPACE,
        key: def.key,
        type: def.type,
        ownerType: "PRODUCT",
        // Without storefront access the Storefront API silently returns null.
        access: { storefront: "PUBLIC_READ" },
        ...(def.choices
          ? { validations: [{ name: "choices", value: JSON.stringify(def.choices) }] }
          : {}),
      },
    });

    const errors = data.metafieldDefinitionCreate.userErrors;
    const alreadyExists = errors.some((e) => e.code === "TAKEN");
    if (errors.length > 0 && !alreadyExists) {
      throw new Error(`Metafield definition "${def.key}" failed: ${errors.map((e) => e.message).join("; ")}`);
    }
    console.log(`Metafield definition ${NAMESPACE}.${def.key}: ${alreadyExists ? "exists" : "created"}`);
  }
}

// ---------------------------------------------------------------------------
// Product upsert
// ---------------------------------------------------------------------------

/** Common shape both catalogs (turf + pest control) seed from. */
type SeedProduct = {
  handle: string;
  title: string;
  description: string;
  productType: string;
  price: number;
  image: { src: string; alt: string };
  metafields: { namespace: string; key: string; type: string; value: string }[];
};

const text = (key: string, value: string) => ({
  namespace: NAMESPACE,
  key,
  type: "single_line_text_field",
  value,
});

function productMetafields(p: Product) {
  return [
    text("tagline", p.tagline),
    text("color", p.specs.color),
    text("texture", p.specs.texture),
    text("wear_tolerance", p.specs.wearTolerance),
    text("drought_tolerance", p.specs.droughtTolerance),
    text("shade_tolerance", p.specs.shadeTolerance),
    text("mow_height", p.specs.mowHeight),
    { namespace: NAMESPACE, key: "stages", type: "json", value: JSON.stringify(p.stages) },
    text("maintenance", p.maintenance),
    {
      namespace: NAMESPACE,
      key: "best_for",
      type: "list.single_line_text_field",
      value: JSON.stringify(p.bestFor),
    },
  ];
}

function toSeedProducts(): SeedProduct[] {
  const turf: SeedProduct[] = products.map((p) => ({
    handle: p.slug,
    title: p.name,
    description: p.description,
    productType: p.category,
    price: p.priceFrom,
    image: p.image,
    metafields: productMetafields(p),
  }));

  const pestControl: SeedProduct[] = controlProducts.map((p: ControlProduct) => ({
    handle: p.slug,
    title: p.name,
    description: p.description,
    productType: "pest-control",
    price: p.price,
    image: p.image,
    metafields: [text("active_ingredient", p.activeIngredient)],
  }));

  return [...turf, ...pestControl];
}

const FIND_PRODUCT_BY_HANDLE = /* GraphQL */ `
  query FindProductByHandle($query: String!) {
    products(first: 1, query: $query) {
      nodes { id handle }
    }
  }
`;

async function findProductIdByHandle(handle: string): Promise<string | null> {
  const data = await adminFetch<{ products: { nodes: { id: string; handle: string }[] } }>(
    FIND_PRODUCT_BY_HANDLE,
    { query: `handle:'${handle}'` }
  );
  const node = data.products.nodes[0];
  return node && node.handle === handle ? node.id : null;
}

const PRODUCT_SET = /* GraphQL */ `
  mutation ProductSet($input: ProductSetInput!) {
    productSet(input: $input, synchronous: true) {
      product { id handle }
      userErrors { field message code }
    }
  }
`;

const GET_PUBLICATIONS = /* GraphQL */ `
  query GetPublications {
    publications(first: 20) {
      nodes { id name }
    }
  }
`;

const PUBLISHABLE_PUBLISH = /* GraphQL */ `
  mutation PublishablePublish($id: ID!, $input: [PublicationInput!]!) {
    publishablePublish(id: $id, input: $input) {
      userErrors { field message }
    }
  }
`;

async function upsertProduct(p: SeedProduct, publicationIds: string[]): Promise<"created" | "updated"> {
  const existingId = await findProductIdByHandle(p.handle);

  const input: Record<string, unknown> = {
    ...(existingId ? { id: existingId } : {}),
    handle: p.handle,
    title: p.title,
    descriptionHtml: `<p>${p.description}</p>`,
    productType: p.productType,
    status: "ACTIVE",
    productOptions: [{ name: "Title", values: [{ name: "Default Title" }] }],
    variants: [
      {
        optionValues: [{ optionName: "Title", name: "Default Title" }],
        price: p.price.toFixed(2),
      },
    ],
    metafields: p.metafields,
    // Only attach media on create so re-runs don't pile up duplicate images.
    ...(existingId
      ? {}
      : { files: [{ originalSource: p.image.src, alt: p.image.alt, contentType: "IMAGE" }] }),
  };

  const data = await adminFetch<{
    productSet: {
      product: { id: string; handle: string } | null;
      userErrors: { field: string[] | null; message: string; code: string }[];
    };
  }>(PRODUCT_SET, { input });

  const { product, userErrors } = data.productSet;
  if (!product || userErrors.length > 0) {
    throw new Error(`productSet for "${p.handle}" failed: ${userErrors.map((e) => e.message).join("; ")}`);
  }

  // Publish to every publication, including the custom app's own — products
  // are invisible to this app's Storefront token until published to it.
  const publishData = await adminFetch<{
    publishablePublish: { userErrors: { message: string }[] };
  }>(PUBLISHABLE_PUBLISH, {
    id: product.id,
    input: publicationIds.map((publicationId) => ({ publicationId })),
  });
  const pubErrors = publishData.publishablePublish.userErrors;
  if (pubErrors.length > 0) {
    throw new Error(`publish for "${p.handle}" failed: ${pubErrors.map((e) => e.message).join("; ")}`);
  }

  return existingId ? "updated" : "created";
}

// ---------------------------------------------------------------------------

async function main() {
  const seedProducts = toSeedProducts();
  console.log(`Seeding ${seedProducts.length} products to ${DOMAIN} (API ${API_VERSION})\n`);

  await fetchAdminToken();
  await ensureStorefrontToken();
  await ensureMetafieldDefinitions();

  const pubData = await adminFetch<{ publications: { nodes: { id: string; name: string }[] } }>(
    GET_PUBLICATIONS
  );
  const publications = pubData.publications.nodes;
  console.log(`\nPublishing to: ${publications.map((p) => p.name).join(", ")}\n`);

  let created = 0;
  let updated = 0;
  for (const p of seedProducts) {
    const result = await upsertProduct(p, publications.map((pub) => pub.id));
    result === "created" ? created++ : updated++;
    console.log(`${result}: ${p.handle} ($${p.price.toFixed(2)})`);
  }

  console.log(`\nDone. ${created} created, ${updated} updated.`);
  console.log("Note: product images ingest asynchronously — allow a minute before they appear.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
