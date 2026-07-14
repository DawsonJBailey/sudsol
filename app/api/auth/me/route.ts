import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getCustomerSession,
  getCustomerProfile,
  sessionCookieValues,
} from "@/lib/shopify/customer";

export const runtime = "nodejs";

/** Lightweight signed-in state for client components (Header, CartContext). */
export async function GET() {
  const session = await getCustomerSession();
  if (!session) {
    return NextResponse.json({ signedIn: false });
  }

  let profile = null;
  try {
    profile = await getCustomerProfile(session.accessToken);
  } catch (err) {
    console.error("Failed to load customer profile:", err);
    // Token may be stale/revoked — report signed out rather than erroring.
    return NextResponse.json({ signedIn: false });
  }

  const res = NextResponse.json({
    signedIn: true,
    email: profile.emailAddress?.emailAddress ?? null,
    firstName: profile.firstName,
  });

  // Persist a lazy refresh so subsequent requests skip the refresh round trip.
  if (session.refreshed) {
    const store = await cookies();
    for (const cookie of sessionCookieValues(session.refreshed)) {
      store.set(cookie.name, cookie.value, cookie.options);
    }
  }
  return res;
}
