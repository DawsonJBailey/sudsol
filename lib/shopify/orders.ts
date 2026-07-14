import "server-only";
import { adminFetch } from "./admin";

export type ShopifyOrderLineItem = {
  title: string;
  quantity: number;
  lineTotal: number;
};

export type ShopifyOrder = {
  id: string;
  /** Shopify order name, e.g. "#1001". */
  name: string;
  createdAt: string;
  financialStatus: string;
  /** Order total in dollars. */
  total: number;
  items: ShopifyOrderLineItem[];
};

const ORDERS_BY_EMAIL = /* GraphQL */ `
  query OrdersByEmail($search: String!) {
    orders(first: 50, sortKey: CREATED_AT, reverse: true, query: $search) {
      nodes {
        id
        name
        createdAt
        displayFinancialStatus
        totalPriceSet {
          shopMoney {
            amount
          }
        }
        lineItems(first: 50) {
          nodes {
            title
            quantity
            discountedTotalSet {
              shopMoney {
                amount
              }
            }
          }
        }
      }
    }
  }
`;

/**
 * Orders placed through Shopify checkout, matched to the signed-in user by
 * the email entered at checkout. Requires the app to have the read_orders
 * scope (and protected-customer-data access); without them this throws and
 * callers should degrade gracefully. Note: without read_all_orders the Admin
 * API only returns orders from the last 60 days.
 */
export async function getShopifyOrdersByEmail(email: string): Promise<ShopifyOrder[]> {
  const escaped = email.replace(/[\\"]/g, "");
  const data = await adminFetch<{
    orders: {
      nodes: {
        id: string;
        name: string;
        createdAt: string;
        displayFinancialStatus: string | null;
        totalPriceSet: { shopMoney: { amount: string } };
        lineItems: {
          nodes: {
            title: string;
            quantity: number;
            discountedTotalSet: { shopMoney: { amount: string } };
          }[];
        };
      }[];
    };
  }>(ORDERS_BY_EMAIL, { search: `email:"${escaped}"` });

  return data.orders.nodes.map((order) => ({
    id: order.id,
    name: order.name,
    createdAt: order.createdAt,
    financialStatus: (order.displayFinancialStatus ?? "PAID").toLowerCase().replace(/_/g, " "),
    total: Number(order.totalPriceSet.shopMoney.amount),
    items: order.lineItems.nodes.map((item) => ({
      title: item.title,
      quantity: item.quantity,
      lineTotal: Number(item.discountedTotalSet.shopMoney.amount),
    })),
  }));
}
