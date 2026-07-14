import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIES, getOpenIdConfig } from "@/lib/shopify/customer";

/** Clears the local session and ends the Shopify customer session. */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const idToken = req.cookies.get(AUTH_COOKIES.idToken)?.value;

  let redirectTo = `${origin}/`;
  try {
    if (idToken) {
      const { end_session_endpoint } = await getOpenIdConfig();
      const logoutUrl = new URL(end_session_endpoint);
      logoutUrl.searchParams.set("id_token_hint", idToken);
      logoutUrl.searchParams.set("post_logout_redirect_uri", `${origin}/`);
      redirectTo = logoutUrl.toString();
    }
  } catch (err) {
    // Discovery failure shouldn't trap the user signed in locally.
    console.error("Logout discovery failed:", err);
  }

  const res = NextResponse.redirect(redirectTo);
  res.cookies.delete(AUTH_COOKIES.accessToken);
  res.cookies.delete(AUTH_COOKIES.refreshToken);
  res.cookies.delete(AUTH_COOKIES.idToken);
  return res;
}
