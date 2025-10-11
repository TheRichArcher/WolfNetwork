import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rateLimit';
import { upsertUserBasic } from '@/lib/db';
import { encryptSecret } from '@/lib/crypto';

export async function POST(req: NextRequest) {
  try {
    const { email, phone } = (await req.json().catch(() => ({}))) as { email?: string; phone?: string };
    const rawEmail = (email || '').trim().toLowerCase();
    const rawPhone = (phone || '').trim();

    if (!rawEmail && !rawPhone) {
      return NextResponse.json({ error: 'Email or phone required' }, { status: 400 });
    }

    const rateKey = `signup:request:${rawEmail || rawPhone}`;
    if (!checkRateLimit(rateKey, 6)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const phoneEncrypted = rawPhone ? encryptSecret(rawPhone) : undefined;
    await upsertUserBasic({ email: rawEmail || undefined, phoneEncrypted, status: 'pending', source: 'waitlist' });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}


