export const METAFIELD_NAMESPACE = "meridian";

export const METAFIELD_KEYS = [
  "tagline",
  "color",
  "texture",
  "wear_tolerance",
  "drought_tolerance",
  "shade_tolerance",
  "mow_height",
  "stages",
  "maintenance",
  "best_for",
  "active_ingredient",
] as const;

// Turf products and pest-control treatments share the store; each query
// filters by productType so neither leaks into the other's listings.
const TURF_QUERY = "product_type:sod OR product_type:seed OR product_type:plugs";
const PEST_CONTROL_QUERY = "product_type:pest-control";

const METAFIELD_IDENTIFIERS = METAFIELD_KEYS.map(
  (key) => `{ namespace: "${METAFIELD_NAMESPACE}", key: "${key}" }`
).join(", ");

// metafields(identifiers:) returns positional entries — null for any key
// missing on the product — so mappers must null-check each entry.
const PRODUCT_FRAGMENT = /* GraphQL */ `
  fragment ProductFields on Product {
    handle
    title
    description
    productType
    featuredImage {
      url
      altText
    }
    priceRange {
      minVariantPrice {
        amount
      }
    }
    variants(first: 1) {
      nodes {
        id
      }
    }
    metafields(identifiers: [${METAFIELD_IDENTIFIERS}]) {
      key
      value
    }
  }
`;

export const GET_PRODUCTS = /* GraphQL */ `
  query GetProducts {
    products(first: 50, sortKey: CREATED_AT, query: "${TURF_QUERY}") {
      nodes {
        ...ProductFields
      }
    }
  }
  ${PRODUCT_FRAGMENT}
`;

export const GET_CONTROL_PRODUCTS = /* GraphQL */ `
  query GetControlProducts {
    products(first: 50, sortKey: CREATED_AT, query: "${PEST_CONTROL_QUERY}") {
      nodes {
        ...ProductFields
      }
    }
  }
  ${PRODUCT_FRAGMENT}
`;

export const GET_PRODUCT_BY_HANDLE = /* GraphQL */ `
  query GetProductByHandle($handle: String!) {
    product(handle: $handle) {
      ...ProductFields
    }
  }
  ${PRODUCT_FRAGMENT}
`;

export const GET_PRODUCT_HANDLES = /* GraphQL */ `
  query GetProductHandles {
    products(first: 50, query: "${TURF_QUERY}") {
      nodes {
        handle
      }
    }
  }
`;

export type ShopifyProductNode = {
  handle: string;
  title: string;
  description: string;
  productType: string;
  featuredImage: { url: string; altText: string | null } | null;
  priceRange: { minVariantPrice: { amount: string } };
  variants: { nodes: { id: string }[] };
  metafields: ({ key: string; value: string } | null)[];
};
