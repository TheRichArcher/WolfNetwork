import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rateLimit';
import { upsertUserBasic, validateCompedCode } from '@/lib/db';

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

    // Mark user as approved and attribute source
    await upsertUserBasic({
      email: rawEmail,
      status: 'approved',
      source: `comped_code:${rawCode}`,
      wolfId: res.wolfId,
    });

    return NextResponse.json({ valid: true, next: '/api/auth/signin' });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}


