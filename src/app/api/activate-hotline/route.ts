import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { checkRateLimit } from '@/lib/rateLimit';
import { logEvent } from '@/lib/log';
import { POST as Activate } from '@/app/api/hotline/activate/route';

export async function POST(req: NextRequest) {
  const authBypass = process.env.AUTH_DEV_BYPASS === 'true';
  try {
    const token = await getToken({ req });
    const email = typeof token?.email === 'string' ? token.email : undefined;

    if (!email && !authBypass) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const key = `hotline:activate-compat:${email || 'dev'}`;
    if (!checkRateLimit(key, 4)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    // Delegate to the new handler to keep logic single-sourced.
    const res = await Activate(req);
    logEvent({ event: 'compat_activate_called', route: '/api/activate-hotline', forwardedTo: '/api/hotline/activate' });
    return res;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}


