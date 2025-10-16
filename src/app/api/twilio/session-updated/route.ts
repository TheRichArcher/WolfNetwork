import { NextRequest, NextResponse } from 'next/server';
import { verifyTwilioSignature } from '@/lib/twilioWebhook';
import { getEnv } from '@/lib/env';

// Twilio webhook for session events (e.g., onParticipantAdded)
export async function POST(req: NextRequest) {
  try {
    const url = req.nextUrl;
    const xSig = req.headers.get('x-twilio-signature');
    const contentType = req.headers.get('content-type') || '';
    const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';

    // Build base URL used for signature payload
    const fullUrl = `${process.env.PUBLIC_BASE_URL || `${url.protocol}//${url.host}`}${url.pathname}`;

    // Early fail-closed in production when signature header is missing
    if (isProd && !xSig) {
      console.log('[twilio] session-updated gate', { isProd: true, hasSig: false, fullUrl });
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
    let params: URLSearchParams | null = null;
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const text = await req.text();
      params = new URLSearchParams(text);
    } else if (contentType.includes('application/json')) {
      const json = await req.json().catch(() => ({}));
      params = new URLSearchParams(Object.entries(json).map(([k, v]) => [k, String(v ?? '')]));
    } else {
      params = new URLSearchParams();
    }

    const sigOk = verifyTwilioSignature({ fullUrl, xSignature: xSig, formParams: params });
    const tokenPresent = Boolean(getEnv().TWILIO_AUTH_TOKEN);
    console.log('[twilio] session-updated verify', { isProd, hasSig: Boolean(xSig), tokenPresent, verified: sigOk });
    if (isProd && !sigOk) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Minimal masked logging for debugging
    const maskedEntries = Array.from(params.entries()).map(([k, v]) => {
      const lower = k.toLowerCase();
      const shouldRedact = lower.includes('from') || lower.includes('to') || /\+?\d{7,}/.test(v);
      return [k, shouldRedact ? '[redacted]' : v] as const;
    });
    console.log('[twilio] session-updated', Object.fromEntries(maskedEntries));

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}


