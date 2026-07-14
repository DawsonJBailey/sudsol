import { storefrontFetch } from "./client";

export type ShopifyCartLine = {
  id: string;
  quantity: number;
  merchandise: {
    id: string;
    price: { amount: string };
    product: { handle: string; title: string };
  };
};

export type ShopifyCart = {
  id: string;
  checkoutUrl: string;
  lines: ShopifyCartLine[];
  cost: { subtotalAmount: { amount: string } };
};

const CART_FRAGMENT = /* GraphQL */ `
  fragment CartFields on Cart {
    id
    checkoutUrl
    lines(first: 50) {
      nodes {
        id
        quantity
        merchandise {
          ... on ProductVariant {
            id
            price {
              amount
            }
            product {
              handle
              title
            }
          }
        }
      }
    }
    cost {
      subtotalAmount {
        amount
      }
    }
  }
`;

type CartPayload = {
  cart: (Omit<ShopifyCart, "lines"> & { lines: { nodes: ShopifyCartLine[] } }) | null;
  userErrors?: { message: string }[];
};

function unwrapCart(operation: string, payload: CartPayload): ShopifyCart {
  if (payload.userErrors?.length) {
    throw new Error(`${operation} failed: ${payload.userErrors.map((e) => e.message).join("; ")}`);
  }
  if (!payload.cart) {
    throw new Error(`${operation} returned no cart`);
  }
  return { ...payload.cart, lines: payload.cart.lines.nodes };
}

export async function cartCreate(
  lines: { merchandiseId: string; quantity: number }[]
): Promise<ShopifyCart> {
  const data = await storefrontFetch<{ cartCreate: CartPayload }>({
    query: /* GraphQL */ `
      mutation CartCreate($input: CartInput!) {
        cartCreate(input: $input) {
          cart { ...CartFields }
          userErrors { message }
        }
      }
      ${CART_FRAGMENT}
    `,
    variables: { input: { lines } },
    revalidate: false,
  });
  return unwrapCart("cartCreate", data.cartCreate);
}

/** Returns null if the cart has expired or was consumed by a completed checkout. */
export async function cartGet(cartId: string): Promise<ShopifyCart | null> {
  const data = await storefrontFetch<{
    cart: (Omit<ShopifyCart, "lines"> & { lines: { nodes: ShopifyCartLine[] } }) | null;
  }>({
    query: /* GraphQL */ `
      query GetCart($cartId: ID!) {
        cart(id: $cartId) {
          ...CartFields
        }
      }
      ${CART_FRAGMENT}
    `,
    variables: { cartId },
    revalidate: false,
  });
  return data.cart ? { ...data.cart, lines: data.cart.lines.nodes } : null;
}

export async function cartLinesAdd(
  cartId: string,
  lines: { merchandiseId: string; quantity: number }[]
): Promise<ShopifyCart> {
  const data = await storefrontFetch<{ cartLinesAdd: CartPayload }>({
    query: /* GraphQL */ `
      mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
        cartLinesAdd(cartId: $cartId, lines: $lines) {
          cart { ...CartFields }
          userErrors { message }
        }
      }
      ${CART_FRAGMENT}
    `,
    variables: { cartId, lines },
    revalidate: false,
  });
  return unwrapCart("cartLinesAdd", data.cartLinesAdd);
}

export async function cartLinesUpdate(
  cartId: string,
  lines: { id: string; quantity: number }[]
): Promise<ShopifyCart> {
  const data = await storefrontFetch<{ cartLinesUpdate: CartPayload }>({
    query: /* GraphQL */ `
      mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
        cartLinesUpdate(cartId: $cartId, lines: $lines) {
          cart { ...CartFields }
          userErrors { message }
        }
      }
      ${CART_FRAGMENT}
    `,
    variables: { cartId, lines },
    revalidate: false,
  });
  return unwrapCart("cartLinesUpdate", data.cartLinesUpdate);
}

/**
 * Attaches the signed-in user's email to the cart so hosted checkout prefills
 * it and the resulting order can be matched back to the account on /orders.
 */
export async function cartBuyerIdentityUpdate(cartId: string, email: string): Promise<ShopifyCart> {
  const data = await storefrontFetch<{ cartBuyerIdentityUpdate: CartPayload }>({
    query: /* GraphQL */ `
      mutation CartBuyerIdentityUpdate($cartId: ID!, $buyerIdentity: CartBuyerIdentityInput!) {
        cartBuyerIdentityUpdate(cartId: $cartId, buyerIdentity: $buyerIdentity) {
          cart { ...CartFields }
          userErrors { message }
        }
      }
      ${CART_FRAGMENT}
    `,
    variables: { cartId, buyerIdentity: { email } },
    revalidate: false,
  });
  return unwrapCart("cartBuyerIdentityUpdate", data.cartBuyerIdentityUpdate);
}

export async function cartLinesRemove(cartId: string, lineIds: string[]): Promise<ShopifyCart> {
  const data = await storefrontFetch<{ cartLinesRemove: CartPayload }>({
    query: /* GraphQL */ `
      mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
        cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
          cart { ...CartFields }
          userErrors { message }
        }
      }
      ${CART_FRAGMENT}
    `,
    variables: { cartId, lineIds },
    revalidate: false,
  });
  return unwrapCart("cartLinesRemove", data.cartLinesRemove);
}
