import "server-only";
import { cookies } from "next/headers";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createClient as createServerSupabaseClient } from "@/utils/supabase/server";
import { products } from "@/lib/data";
import { upsertHubSpotContact } from "@/lib/hubspot";

export type OrderItem = {
  slug: string;
  name: string;
  price: number;
  quantity: number;
};

export type Order = {
  id: string;
  user_id: string | null;
  stripe_payment_intent_id: string;
  status: string;
  amount_total: number;
  currency: string;
  customer_name: string | null;
  customer_email: string | null;
  shipping_address: Record<string, unknown> | null;
  items: OrderItem[];
  created_at: string;
};

function buildItemsFromMetadata(metadata: Stripe.Metadata): OrderItem[] {
  let cart: { slug: string; quantity: number }[] = [];
  try {
    cart = JSON.parse(metadata.cart ?? "[]");
  } catch {
    cart = [];
  }

  return cart
    .map((entry) => {
      const product = products.find((p) => p.slug === entry.slug);
      if (!product) return null;
      return {
        slug: product.slug,
        name: product.name,
        price: product.priceFrom,
        quantity: entry.quantity,
      };
    })
    .filter((item): item is OrderItem => item !== null);
}

/**
 * Verifies a PaymentIntent with Stripe and records it as an order (idempotent
 * on stripe_payment_intent_id). Returns null if the payment didn't succeed.
 */
export async function recordOrderForPaymentIntent(paymentIntentId: string): Promise<Order | null> {
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ["payment_method"],
  });

  if (paymentIntent.status !== "succeeded") {
    return null;
  }

  const { data: existing } = await supabaseAdmin
    .from("orders")
    .select("*")
    .eq("stripe_payment_intent_id", paymentIntent.id)
    .maybeSingle();

  if (existing) {
    return existing as Order;
  }

  const paymentMethod =
    typeof paymentIntent.payment_method === "object" ? paymentIntent.payment_method : null;
  const billingDetails = paymentMethod?.billing_details;

  const cookieStore = await cookies();
  const supabase = createServerSupabaseClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: inserted, error } = await supabaseAdmin
    .from("orders")
    .insert({
      user_id: user?.id ?? null,
      stripe_payment_intent_id: paymentIntent.id,
      status: "paid",
      amount_total: paymentIntent.amount,
      currency: paymentIntent.currency,
      customer_name: billingDetails?.name ?? null,
      customer_email: billingDetails?.email ?? user?.email ?? null,
      shipping_address: billingDetails?.address ?? null,
      items: buildItemsFromMetadata(paymentIntent.metadata),
    })
    .select("*")
    .single();

  if (error) {
    const { data: fallback } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("stripe_payment_intent_id", paymentIntent.id)
      .maybeSingle();
    return (fallback as Order) ?? null;
  }

  // A completed purchase is the opposite of an abandoned cart: clear the
  // shadow cart row and any HubSpot abandonment flag so this contact doesn't
  // stay marked as having an abandoned cart, or get emailed about one later.
  if (user?.id) {
    await supabaseAdmin.from("carts").delete().eq("user_id", user.id);

    if (user.email) {
      try {
        await upsertHubSpotContact({
          email: user.email,
          cart_abandoned_at: "",
          abandoned_cart_summary: "",
        });
      } catch (err) {
        console.error("Failed to clear HubSpot abandoned-cart flag:", err);
      }
    }
  }

  return inserted as Order;
}

export async function getOrdersForCurrentUser(): Promise<Order[]> {
  const cookieStore = await cookies();
  const supabase = createServerSupabaseClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return [];
  return data as Order[];
}
