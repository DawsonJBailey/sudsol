import { NextRequest, NextResponse } from "next/server";
import { adminFetch } from "@/lib/shopify/admin";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Subscribes an email to marketing as a Shopify customer (created if new).
 * Subscribers appear in admin under Customers → "Email subscribers" and can
 * be mailed with Shopify Email. Requires the write_customers Admin scope.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
    }

    const escaped = email.replace(/[\\"]/g, "");
    const found = await adminFetch<{
      customers: { nodes: { id: string }[] };
    }>(
      /* GraphQL */ `
        query FindCustomer($search: String!) {
          customers(first: 1, query: $search) {
            nodes {
              id
            }
          }
        }
      `,
      { search: `email:"${escaped}"` }
    );

    const existingId = found.customers.nodes[0]?.id ?? null;

    if (existingId) {
      const data = await adminFetch<{
        customerEmailMarketingConsentUpdate: { userErrors: { message: string }[] };
      }>(
        /* GraphQL */ `
          mutation SubscribeExisting($input: CustomerEmailMarketingConsentUpdateInput!) {
            customerEmailMarketingConsentUpdate(input: $input) {
              userErrors {
                message
              }
            }
          }
        `,
        {
          input: {
            customerId: existingId,
            emailMarketingConsent: {
              marketingState: "SUBSCRIBED",
              marketingOptInLevel: "SINGLE_OPT_IN",
              consentUpdatedAt: new Date().toISOString(),
            },
          },
        }
      );
      const errors = data.customerEmailMarketingConsentUpdate.userErrors;
      if (errors.length > 0) {
        throw new Error(errors.map((e) => e.message).join("; "));
      }
    } else {
      const data = await adminFetch<{
        customerCreate: {
          customer: { id: string } | null;
          userErrors: { message: string }[];
        };
      }>(
        /* GraphQL */ `
          mutation SubscribeNew($input: CustomerInput!) {
            customerCreate(input: $input) {
              customer {
                id
              }
              userErrors {
                message
              }
            }
          }
        `,
        {
          input: {
            email,
            emailMarketingConsent: {
              marketingState: "SUBSCRIBED",
              marketingOptInLevel: "SINGLE_OPT_IN",
            },
          },
        }
      );
      const payload = data.customerCreate;
      if (!payload.customer || payload.userErrors.length > 0) {
        throw new Error(payload.userErrors.map((e) => e.message).join("; "));
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("newsletter-signup route error:", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 502 });
  }
}
