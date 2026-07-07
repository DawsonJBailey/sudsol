import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient as createServerSupabaseClient } from "@/utils/supabase/server";
import { getOrdersForCurrentUser } from "@/lib/orders";

export default async function OrdersPage() {
  const cookieStore = await cookies();
  const supabase = createServerSupabaseClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const orders = await getOrdersForCurrentUser();

  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <p className="text-xs uppercase tracking-widest text-gold font-semibold mb-2">Account</p>
      <h1 className="font-display text-3xl md:text-4xl text-pine mb-10">My Orders</h1>

      {orders.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-charcoal/70 mb-8">You haven't placed any orders yet.</p>
          <Link
            href="/shop/sod"
            className="inline-block bg-pine text-parchment font-medium px-7 py-3 rounded-full hover:bg-pine-dark transition-colors"
          >
            Shop Varieties
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          {orders.map((order) => {
            const orderNumber = `MT-${order.stripe_payment_intent_id.slice(-6).toUpperCase()}`;
            const date = new Date(order.created_at).toLocaleDateString(undefined, {
              year: "numeric",
              month: "long",
              day: "numeric",
            });

            return (
              <div
                key={order.id}
                className="rounded-2xl border border-pine/10 bg-white/60 overflow-hidden"
              >
                <div className="flex items-center justify-between px-5 py-4 border-b border-pine/10">
                  <div>
                    <p className="font-medium text-charcoal">{orderNumber}</p>
                    <p className="text-xs text-charcoal/50">{date}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-charcoal">
                      ${(order.amount_total / 100).toFixed(2)}
                    </p>
                    <p className="text-xs text-gold uppercase tracking-wide font-semibold">
                      {order.status}
                    </p>
                  </div>
                </div>
                <div className="divide-y divide-pine/10">
                  {order.items.map((item) => (
                    <div
                      key={item.slug}
                      className="flex justify-between px-5 py-3 text-sm text-charcoal/80"
                    >
                      <span>
                        {item.name} <span className="text-charcoal/50">× {item.quantity}</span>
                      </span>
                      <span>${(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
