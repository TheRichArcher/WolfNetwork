import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { checkRateLimit } from '@/lib/rateLimit';
import { encryptSecret } from '@/lib/crypto';
import Airtable from 'airtable';
import { getEnv } from '@/lib/env';
import { logEvent } from '@/lib/log';

function isValidE164(input: string): boolean {
  return /^\+[1-9]\d{6,14}$/.test(input);
}

export async function PUT(req: NextRequest) {
  try {
    const token = await getToken({ req });
    const email = typeof token?.email === 'string' ? token.email : undefined;
    if (!email) {
      logEvent({ event: 'me_phone_unauthorized', route: '/api/me/phone' }, 'warn');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const bypassSet = (process.env.BIOMETRIC_BYPASS_EMAILS || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    const biometricOk = req.cookies.get('biometric_ok')?.value === '1' || (email && bypassSet.includes(email.toLowerCase()));
    if (!biometricOk) {
      logEvent({ event: 'me_phone_biometric_required', route: '/api/me/phone', email }, 'warn');
      return NextResponse.json({ error: 'Biometric required' }, { status: 403 });
    }

    if (!checkRateLimit(`me:phone:${email}`, 6)) {
      logEvent({ event: 'me_phone_rate_limited', route: '/api/me/phone', email }, 'warn');
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { phoneE164 } = (await req.json().catch(() => ({}))) as { phoneE164?: string };
    const raw = (phoneE164 || '').trim();
    if (!isValidE164(raw)) {
      logEvent({ event: 'me_phone_invalid_format', route: '/api/me/phone', email, value: raw.slice(0, 4) + '…' }, 'warn');
      return NextResponse.json({ error: 'Invalid phone format' }, { status: 400 });
    }

    const env = getEnv();
    if (!env.AIRTABLE_API_KEY || !env.AIRTABLE_BASE_ID) {
      logEvent({ event: 'me_phone_env_missing', route: '/api/me/phone' }, 'error');
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }
    const base = new Airtable({ apiKey: env.AIRTABLE_API_KEY }).base(env.AIRTABLE_BASE_ID);
    const users = base('users');

    const records = await users.select({ filterByFormula: `{email} = '${email}'`, maxRecords: 1 }).firstPage();
    if (records.length === 0) {
      logEvent({ event: 'me_phone_user_not_found', route: '/api/me/phone', email }, 'warn');
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const rec = records[0];

    let enc: string;
    try {
      enc = encryptSecret(raw);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      logEvent({ event: 'me_phone_encrypt_failed', route: '/api/me/phone', email, error: msg }, 'error');
      return NextResponse.json({ error: 'Encryption failed' }, { status: 500 });
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await users.update([{ id: rec.id, fields: { phoneEncrypted: enc } as unknown as any }]);

    logEvent({ event: 'user_phone_updated', route: '/api/me/phone', email, wolfId: rec.get('wolfId') || undefined });

    return new NextResponse(null, { status: 204 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    logEvent({ event: 'me_phone_exception', route: '/api/me/phone', error: msg }, 'error');
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}



