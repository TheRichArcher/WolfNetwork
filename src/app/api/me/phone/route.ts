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
    if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const biometricOk = req.cookies.get('biometric_ok')?.value === '1';
    if (!biometricOk) return NextResponse.json({ error: 'Biometric required' }, { status: 403 });

    if (!checkRateLimit(`me:phone:${email}`, 6)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { phoneE164 } = (await req.json().catch(() => ({}))) as { phoneE164?: string };
    const raw = (phoneE164 || '').trim();
    if (!isValidE164(raw)) return NextResponse.json({ error: 'Invalid phone format' }, { status: 400 });

    const env = getEnv();
    if (!env.AIRTABLE_API_KEY || !env.AIRTABLE_BASE_ID) {
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }
    const base = new Airtable({ apiKey: env.AIRTABLE_API_KEY }).base(env.AIRTABLE_BASE_ID);
    const users = base('users');

    const records = await users.select({ filterByFormula: `{email} = '${email}'`, maxRecords: 1 }).firstPage();
    if (records.length === 0) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const rec = records[0];

    const enc = encryptSecret(raw);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await users.update([{ id: rec.id, fields: { phoneEncrypted: enc } as unknown as any }]);

    logEvent({ event: 'user_phone_updated', route: '/api/me/phone', email, wolfId: rec.get('wolfId') || undefined });

    return new NextResponse(null, { status: 204 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}



