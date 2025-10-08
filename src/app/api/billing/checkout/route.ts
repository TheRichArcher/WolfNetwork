import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/lib/env";

type CheckoutBody = { tier: "Silver" | "Gold" | "Platinum" };

async function createStripeCheckout(params: {
  secretKey: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
}) {
  const { secretKey, priceId, successUrl, cancelUrl } = params;
  const body = new URLSearchParams({
    mode: "subscription",
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": "1",
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  const resp = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Stripe checkout create failed (${resp.status}): ${text}`);
  }
  return resp.json();
}

export async function POST(req: NextRequest) {
  try {
    const env = getEnv();
    const body = (await req.json().catch(() => ({}))) as CheckoutBody;
    const tier = body.tier || "Gold";

    const priceMap: Record<string, string | undefined> = {
      Silver: env.STRIPE_PRICE_SILVER_ID,
      Gold: env.STRIPE_PRICE_GOLD_ID,
      Platinum: env.STRIPE_PRICE_PLATINUM_ID,
    };
    const priceId = priceMap[tier];
    if (!env.STRIPE_SECRET_KEY || !priceId) {
      return NextResponse.json({ error: "Stripe configuration missing" }, { status: 500 });
    }

    const base = env.PUBLIC_BASE_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
    const successUrl = `${base}/profile?checkout=success&tier=${encodeURIComponent(tier)}`;
    const cancelUrl = `${base}/profile?checkout=cancel`;

    const session = await createStripeCheckout({
      secretKey: env.STRIPE_SECRET_KEY,
      priceId,
      successUrl,
      cancelUrl,
    });

    return NextResponse.json({ url: session.url, id: session.id });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}


