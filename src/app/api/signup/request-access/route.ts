import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rateLimit';
import { upsertUserBasic } from '@/lib/db';
import { encryptSecret } from '@/lib/crypto';
import { logEvent } from '@/lib/log';

export const runtime = 'nodejs';

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

    const canEncrypt = !!process.env.ENCRYPTION_KEY;
    const canDb = !!(process.env.AIRTABLE_API_KEY && process.env.AIRTABLE_BASE_ID);

    const phoneEncrypted = rawPhone && canEncrypt ? encryptSecret(rawPhone) : undefined;

    if (!canDb) {
      // In development, allow a no-op to avoid 500s when Airtable is not configured.
      if (process.env.NODE_ENV !== 'production') {
        logEvent({ event: 'request_access_noop', reason: 'missing_airtable_env', email: rawEmail, hasPhone: !!rawPhone });
        return NextResponse.json({ ok: true });
      }
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }

    await upsertUserBasic({ email: rawEmail || undefined, phoneEncrypted, status: 'pending', source: 'waitlist' });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}


