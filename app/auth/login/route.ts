import { NextRequest, NextResponse } from "next/server";
import {
  AUTH_COOKIES,
  SCOPES,
  getOpenIdConfig,
  pkceChallenge,
  randomToken,
} from "@/lib/shopify/customer";

/** Kicks off the Customer Account API OAuth flow (public client + PKCE). */
export async function GET(req: NextRequest) {
  const clientId = process.env.SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID is not set" },
      { status: 500 }
    );
  }

  const origin = req.nextUrl.origin;
  const next = req.nextUrl.searchParams.get("next") ?? "/";

  const state = randomToken(16);
  const nonce = randomToken(16);
  const verifier = randomToken(32);
  const challenge = await pkceChallenge(verifier);

  const { authorization_endpoint } = await getOpenIdConfig();
  const authUrl = new URL(authorization_endpoint);
  authUrl.searchParams.set("scope", SCOPES);
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", `${origin}/auth/callback`);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("nonce", nonce);
  authUrl.searchParams.set("code_challenge", challenge);
  authUrl.searchParams.set("code_challenge_method", "S256");

  const res = NextResponse.redirect(authUrl);
  const cookieOpts = {
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 600,
  };
  // `next` rides along in the state cookie so the callback can restore it.
  res.cookies.set(AUTH_COOKIES.state, `${state}:${encodeURIComponent(next)}`, cookieOpts);
  res.cookies.set(AUTH_COOKIES.verifier, verifier, cookieOpts);
  res.cookies.set(AUTH_COOKIES.nonce, nonce, cookieOpts);
  return res;
}
