import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { findUserBySessionEmail, createIncident, updateIncident } from '@/lib/db';
import { decryptSecret } from '@/lib/crypto';
import { createDirectCall } from '@/lib/twilioCalls';
import { getEnv } from '@/lib/env';
import { logEvent } from '@/lib/log';
import { checkRateLimit } from '@/lib/rateLimit';

export async function POST(req: NextRequest) {
  try {
    const token = await getToken({ req });
    const email = typeof token?.email === 'string' ? token.email : undefined;
    if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Basic rate limit per user
    if (!checkRateLimit(`hotline:activate:${email}`, 4)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const user = await findUserBySessionEmail(email);
    if (!user || !user.phoneEncrypted) return NextResponse.json({ error: 'Phone not configured' }, { status: 400 });

    const toNumber = decryptSecret(user.phoneEncrypted);
    const env = getEnv();
    const base = env.PUBLIC_BASE_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
    const twimlUrl = `${base}/api/hotline/twiml`;

    const incidentId = crypto.randomUUID();
    const incident = await createIncident({
      id: incidentId,
      wolfId: user.wolfId,
      sessionSid: '',
      status: 'initiated',
      createdAt: new Date().toISOString(),
      tier: user.tier,
      region: user.region,
    });

    try {
      const call = await createDirectCall(toNumber, twimlUrl);
      await updateIncident(incident.id, { callSid: call.sid });
      logEvent({ event: 'hotline_activated', route: '/api/hotline/activate', incidentId: incident.id, wolfId: user.wolfId, callSid: call.sid });
      return NextResponse.json({ incidentId: incident.id, callSid: call.sid });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      await updateIncident(incident.id, { status: 'resolved', resolvedAt: new Date().toISOString(), statusReason: 'failed' });
      logEvent({ event: 'call_failed', route: '/api/hotline/activate', incidentId: incident.id, wolfId: user.wolfId, error: msg }, 'error');
      return NextResponse.json({ error: 'Call initiation failed' }, { status: 502 });
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}


