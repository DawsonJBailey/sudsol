import { NextRequest, NextResponse } from "next/server";
import {
  AUTH_COOKIES,
  exchangeCodeForTokens,
  sessionCookieValues,
} from "@/lib/shopify/customer";

/** OAuth callback: validates state, exchanges the code, sets session cookies. */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");

  const stateCookie = req.cookies.get(AUTH_COOKIES.state)?.value ?? "";
  const [expectedState, encodedNext] = stateCookie.split(":");
  const next = encodedNext ? decodeURIComponent(encodedNext) : "/";

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  const verifier = req.cookies.get(AUTH_COOKIES.verifier)?.value;
  if (!verifier) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  try {
    const tokens = await exchangeCodeForTokens(code, verifier, `${origin}/auth/callback`);
    const res = NextResponse.redirect(`${origin}${next.startsWith("/") ? next : "/"}`);
    for (const cookie of sessionCookieValues(tokens)) {
      res.cookies.set(cookie.name, cookie.value, cookie.options);
    }
    res.cookies.delete(AUTH_COOKIES.state);
    res.cookies.delete(AUTH_COOKIES.verifier);
    res.cookies.delete(AUTH_COOKIES.nonce);
    return res;
  } catch (err) {
    console.error("Customer auth callback failed:", err);
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }
}
