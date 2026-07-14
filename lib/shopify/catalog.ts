import "server-only";
import type { Product } from "@/lib/data";
import type { ControlProduct } from "@/lib/pests";
import { storefrontFetch } from "./client";
import {
  GET_PRODUCTS,
  GET_CONTROL_PRODUCTS,
  GET_PRODUCT_BY_HANDLE,
  GET_PRODUCT_HANDLES,
  type ShopifyProductNode,
} from "./queries";

/** The existing Product shape, plus the variant GID the Cart API needs. */
export type CatalogProduct = Product & { variantId: string };

/** Pest-control treatment, plus the variant GID the Cart API needs. */
export type ControlCatalogProduct = ControlProduct & { variantId: string };

const TURF_CATEGORIES = ["sod", "seed", "plugs"];

// Shown while Shopify is still ingesting a product's image asynchronously.
const FALLBACK_IMAGE = {
  src: "https://images.pexels.com/photos/413195/pexels-photo-413195.jpeg?auto=compress&cs=tinysrgb&w=1600",
  alt: "Healthy green lawn",
};

function toCatalogProduct(node: ShopifyProductNode): CatalogProduct {
  const meta: Record<string, string> = {};
  for (const field of node.metafields) {
    if (field) meta[field.key] = field.value;
  }

  let stages: Product["stages"] = [];
  try {
    stages = meta.stages ? JSON.parse(meta.stages) : [];
  } catch {
    stages = [];
  }

  let bestFor: Product["bestFor"] = [];
  try {
    bestFor = meta.best_for ? JSON.parse(meta.best_for) : [];
  } catch {
    bestFor = [];
  }

  return {
    slug: node.handle,
    name: node.title,
    category: (node.productType || "sod") as Product["category"],
    tagline: meta.tagline ?? "",
    priceFrom: Number(node.priceRange.minVariantPrice.amount),
    description: node.description,
    image: node.featuredImage
      ? { src: node.featuredImage.url, alt: node.featuredImage.altText ?? node.title }
      : FALLBACK_IMAGE,
    specs: {
      color: meta.color ?? "",
      texture: meta.texture ?? "",
      wearTolerance: meta.wear_tolerance ?? "",
      droughtTolerance: meta.drought_tolerance ?? "",
      shadeTolerance: meta.shade_tolerance ?? "",
      mowHeight: meta.mow_height ?? "",
    },
    stages,
    maintenance: (meta.maintenance ?? "medium") as Product["maintenance"],
    bestFor,
    variantId: node.variants.nodes[0]?.id ?? "",
  };
}

function toControlProduct(node: ShopifyProductNode): ControlCatalogProduct {
  const meta: Record<string, string> = {};
  for (const field of node.metafields) {
    if (field) meta[field.key] = field.value;
  }

  return {
    slug: node.handle,
    name: node.title,
    activeIngredient: meta.active_ingredient ?? "",
    price: Number(node.priceRange.minVariantPrice.amount),
    description: node.description,
    image: node.featuredImage
      ? { src: node.featuredImage.url, alt: node.featuredImage.altText ?? node.title }
      : FALLBACK_IMAGE,
    variantId: node.variants.nodes[0]?.id ?? "",
  };
}

export async function getProducts(): Promise<CatalogProduct[]> {
  const data = await storefrontFetch<{ products: { nodes: ShopifyProductNode[] } }>({
    query: GET_PRODUCTS,
  });
  return data.products.nodes.map(toCatalogProduct);
}

export async function getProductByHandle(handle: string): Promise<CatalogProduct | null> {
  const data = await storefrontFetch<{ product: ShopifyProductNode | null }>({
    query: GET_PRODUCT_BY_HANDLE,
    variables: { handle },
  });
  // Pest-control treatments share the store; keep them off turf product pages.
  if (!data.product || !TURF_CATEGORIES.includes(data.product.productType)) return null;
  return toCatalogProduct(data.product);
}

export async function getControlProducts(): Promise<ControlCatalogProduct[]> {
  const data = await storefrontFetch<{ products: { nodes: ShopifyProductNode[] } }>({
    query: GET_CONTROL_PRODUCTS,
  });
  return data.products.nodes.map(toControlProduct);
}

export async function getControlProductByHandle(
  handle: string
): Promise<ControlCatalogProduct | null> {
  const data = await storefrontFetch<{ product: ShopifyProductNode | null }>({
    query: GET_PRODUCT_BY_HANDLE,
    variables: { handle },
  });
  if (!data.product || data.product.productType !== "pest-control") return null;
  return toControlProduct(data.product);
}

export async function getProductHandles(): Promise<string[]> {
  const data = await storefrontFetch<{ products: { nodes: { handle: string }[] } }>({
    query: GET_PRODUCT_HANDLES,
  });
  return data.products.nodes.map((n) => n.handle);
}
