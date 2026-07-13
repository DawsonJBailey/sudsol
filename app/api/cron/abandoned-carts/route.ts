import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { upsertHubSpotContact } from "@/lib/hubspot";
import type { CartItem } from "@/components/CartContext";

export const runtime = "nodejs";

// A cart with no activity for this long, that hasn't already been reported to
// HubSpot for its current contents, is considered abandoned.
const ABANDONED_AFTER_MINUTES = 60;

function summarizeItems(items: CartItem[]): string {
  return items
    .map((item) => `${item.quantity}x ${item.name} ($${item.price.toFixed(2)} each)`)
    .join("\n");
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - ABANDONED_AFTER_MINUTES * 60 * 1000).toISOString();

  const { data: carts, error } = await supabaseAdmin
    .from("carts")
    .select("user_id, items, updated_at")
    .is("hubspot_synced_at", null)
    .lt("updated_at", cutoff)
    .not("items", "eq", "[]");

  if (error) {
    console.error("abandoned-carts cron: failed to query carts", error);
    return NextResponse.json({ error: "Failed to query carts" }, { status: 500 });
  }

  let notified = 0;
  let skipped = 0;

  for (const cart of carts ?? []) {
    const items = cart.items as CartItem[];
    if (!Array.isArray(items) || items.length === 0) {
      skipped++;
      continue;
    }

    const { data: userResult, error: userError } = await supabaseAdmin.auth.admin.getUserById(
      cart.user_id
    );
    const email = userResult?.user?.email;

    if (userError || !email) {
      skipped++;
      continue;
    }

    try {
      await upsertHubSpotContact({
        email,
        cart_abandoned_at: new Date().toISOString(),
        abandoned_cart_summary: summarizeItems(items),
      });

      await supabaseAdmin
        .from("carts")
        .update({ hubspot_synced_at: new Date().toISOString() })
        .eq("user_id", cart.user_id);

      notified++;
    } catch (err) {
      console.error(`abandoned-carts cron: failed to notify HubSpot for ${email}`, err);
      skipped++;
    }
  }

  return NextResponse.json({ notified, skipped, checked: carts?.length ?? 0 });
}
