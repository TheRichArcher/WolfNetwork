import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  try {
    const { tier } = (await req.json().catch(() => ({}))) as { tier?: string };
    if (!tier) return NextResponse.json({ error: "Missing tier" }, { status: 400 });
    // For MVP we trust the return param; future: validate session via Stripe API
    const jar = await cookies();
    jar.set("userTier", tier, { path: "/", httpOnly: false, sameSite: "lax", maxAge: 60 * 60 * 24 * 180 });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


