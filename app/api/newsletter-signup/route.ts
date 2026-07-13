import { NextRequest, NextResponse } from "next/server";
import { upsertHubSpotContact } from "@/lib/hubspot";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
    }

    if (!process.env.HUBSPOT_ACCESS_TOKEN) {
      return NextResponse.json(
        { error: "Server is missing HUBSPOT_ACCESS_TOKEN. Add it to .env.local." },
        { status: 500 }
      );
    }

    await upsertHubSpotContact({
      email,
      lifecyclestage: "subscriber",
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("newsletter-signup route error:", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 502 });
  }
}
