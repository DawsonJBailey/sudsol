import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCustomerSession, sessionCookieValues } from "@/lib/shopify/customer";
import { storefrontFetch } from "@/lib/shopify/client";

export const runtime = "nodejs";

/**
 * Associates the signed-in customer with a cart (server-side, so the
 * Customer Account API token never reaches the browser). Hosted checkout
 * then opens already authenticated. No-op when signed out.
 */
export async function POST(req: NextRequest) {
  const { cartId } = (await req.json().catch(() => ({}))) as { cartId?: string };
  if (!cartId) {
    return NextResponse.json({ error: "cartId required" }, { status: 400 });
  }

  const session = await getCustomerSession();
  if (!session) {
    return NextResponse.json({ attached: false });
  }

  try {
    const data = await storefrontFetch<{
      cartBuyerIdentityUpdate: {
        cart: { id: string; checkoutUrl: string } | null;
        userErrors: { message: string }[];
      };
    }>({
      query: /* GraphQL */ `
        mutation CartBuyerIdentityUpdate($cartId: ID!, $buyerIdentity: CartBuyerIdentityInput!) {
          cartBuyerIdentityUpdate(cartId: $cartId, buyerIdentity: $buyerIdentity) {
            cart {
              id
              checkoutUrl
            }
            userErrors {
              message
            }
          }
        }
      `,
      variables: { cartId, buyerIdentity: { customerAccessToken: session.accessToken } },
      revalidate: false,
    });

    const payload = data.cartBuyerIdentityUpdate;
    if (!payload.cart || payload.userErrors.length > 0) {
      console.error(
        "cartBuyerIdentityUpdate failed:",
        payload.userErrors.map((e) => e.message).join("; ")
      );
      return NextResponse.json({ attached: false });
    }

    if (session.refreshed) {
      const store = await cookies();
      for (const cookie of sessionCookieValues(session.refreshed)) {
        store.set(cookie.name, cookie.value, cookie.options);
      }
    }

    return NextResponse.json({ attached: true, checkoutUrl: payload.cart.checkoutUrl });
  } catch (err) {
    console.error("attach-buyer failed:", err);
    return NextResponse.json({ attached: false });
  }
}
