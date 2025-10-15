import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rateLimit';
import { upsertUserBasic, validateCompedCode, generateUniqueWolfId, auditCodeWithWolfId } from '@/lib/db';
import { logEvent } from '@/lib/log';

export async function POST(req: NextRequest) {
  try {
    const { email, code } = (await req.json().catch(() => ({}))) as { email?: string; code?: string };
    const rawEmail = (email || '').trim().toLowerCase();
    const rawCode = (code || '').trim();

    if (!rawEmail || !rawCode) {
      return NextResponse.json({ error: 'Email and code are required' }, { status: 400 });
    }

    const rateKey = `signup:comped:${rawEmail}`;
    if (!checkRateLimit(rateKey, 6)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const res = await validateCompedCode(rawCode);
    if (!res.valid) {
      return NextResponse.json({ valid: false, error: 'Invalid code' }, { status: 200 });
    }

    let wolfId = res.wolfId;
    const tier = res.tier || 'Silver';

    if (!wolfId || wolfId.trim().length === 0) {
      wolfId = await generateUniqueWolfId({ tier });
      logEvent({ event: 'wolfid_generated_from_code', code: rawCode, wolfId, tier });
      // Best-effort audit back to codes table
      auditCodeWithWolfId({ code: rawCode, wolfId }).catch(() => {});
    }

    // Mark user as approved and attribute source
    await upsertUserBasic({
      email: rawEmail,
      status: 'approved',
      source: `comped_code:${rawCode}`,
      wolfId,
      tier,
    });

    return NextResponse.json({ valid: true, next: '/api/auth/signin' });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}


