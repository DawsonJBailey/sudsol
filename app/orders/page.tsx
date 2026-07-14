import Link from "next/link";
import { redirect } from "next/navigation";
import { getCustomerSession, getCustomerOrders, type CustomerOrder } from "@/lib/shopify/customer";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const session = await getCustomerSession();
  if (!session) {
    redirect("/login");
  }

  let orders: CustomerOrder[] = [];
  try {
    orders = await getCustomerOrders(session.accessToken);
  } catch (err) {
    console.error("Failed to load customer orders:", err);
    redirect("/login");
  }

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
            const date = new Date(order.processedAt).toLocaleDateString(undefined, {
              year: "numeric",
              month: "long",
              day: "numeric",
            });

            return (
              <a
                key={order.id}
                href={order.statusPageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-2xl border border-pine/10 bg-white/60 overflow-hidden transition-shadow hover:shadow-md hover:border-pine/25 focus:outline-none focus:ring-2 focus:ring-gold"
                aria-label={`View details for order ${order.name}`}
              >
                <div className="flex items-center justify-between px-5 py-4 border-b border-pine/10">
                  <div>
                    <p className="font-medium text-charcoal">
                      {order.name}
                      <span className="ml-2 text-xs text-charcoal/40">↗ view details</span>
                    </p>
                    <p className="text-xs text-charcoal/50">{date}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-charcoal">${order.total.toFixed(2)}</p>
                    <p className="text-xs text-gold uppercase tracking-wide font-semibold">
                      {order.financialStatus}
                    </p>
                  </div>
                </div>
                <div className="divide-y divide-pine/10">
                  {order.items.map((item) => (
                    <div
                      key={item.key}
                      className="flex justify-between px-5 py-3 text-sm text-charcoal/80"
                    >
                      <span>
                        {item.name} <span className="text-charcoal/50">× {item.quantity}</span>
                      </span>
                      <span>${item.lineTotal.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
