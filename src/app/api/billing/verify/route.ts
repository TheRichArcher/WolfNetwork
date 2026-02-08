import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { cookies } from "next/headers";
import { getEnv } from "@/lib/env";

const VALID_TIERS = new Set(["Silver", "Gold", "Platinum"]);

export async function POST(req: NextRequest) {
  try {
    // Require authentication
    const token = await getToken({ req });
    if (!token?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sessionId } = (await req.json().catch(() => ({}))) as { sessionId?: string };

    // If Stripe is configured and a session ID is provided, verify against Stripe
    const env = getEnv();
    const stripeKey = env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY;
    let tier = "Silver"; // default

    if (stripeKey && sessionId) {
      try {
        const resp = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
          headers: { Authorization: `Bearer ${stripeKey}` },
        });
        if (resp.ok) {
          const session = await resp.json();
          // Extract tier from metadata if set during checkout creation
          const metaTier = session.metadata?.tier;
          if (metaTier && VALID_TIERS.has(metaTier)) {
            tier = metaTier;
          }
        } else {
          return NextResponse.json({ error: "Invalid Stripe session" }, { status: 400 });
        }
      } catch {
        return NextResponse.json({ error: "Stripe verification failed" }, { status: 500 });
      }
    } else if (!stripeKey) {
      // No Stripe configured — reject. Don't trust client-sent tier.
      return NextResponse.json({ error: "Billing verification not available" }, { status: 503 });
    } else {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    const jar = await cookies();
    jar.set("userTier", tier, { path: "/", httpOnly: true, secure: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 180 });
    return NextResponse.json({ ok: true, tier });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
