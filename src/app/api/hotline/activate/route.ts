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
    const authBypass = process.env.AUTH_DEV_BYPASS === 'true';
    if (!email && !authBypass) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Basic rate limit per user
    if (!checkRateLimit(`hotline:activate:${email}`, 4)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const user = email ? await findUserBySessionEmail(email) : null;
    if (!user && !authBypass) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const toNumber = user?.phoneEncrypted ? decryptSecret(user.phoneEncrypted) : process.env.DEV_CALLER_E164 || '';
    if (!toNumber) return NextResponse.json({ error: 'Phone not configured' }, { status: 400 });

    const env = getEnv();
    const base = env.PUBLIC_BASE_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
    const twimlUrl = `${base}/api/hotline/twiml`;

    let incidentId = crypto.randomUUID();
    let persisted = true;
    try {
      const incident = await createIncident({
        id: incidentId,
        wolfId: user?.wolfId || 'WOLF-DEV-TEST',
        sessionSid: '',
        status: 'initiated',
        createdAt: new Date().toISOString(),
        tier: user?.tier || 'Gold',
        region: user?.region || 'LA',
      });
      incidentId = incident.id;
    } catch (e: unknown) {
      if (authBypass) {
        persisted = false;
        const msg = e instanceof Error ? e.message : String(e);
        logEvent({ event: 'incident_create_failed_bypass', route: '/api/hotline/activate', error: msg });
      } else {
        throw e;
      }
    }

    try {
      const call = await createDirectCall(toNumber, twimlUrl);
      if (persisted) {
        await updateIncident(incidentId, { callSid: call.sid });
      }
      logEvent({ event: 'hotline_activated', route: '/api/hotline/activate', incidentId, wolfId: user?.wolfId || 'WOLF-DEV-TEST', callSid: call.sid, bypass: authBypass });
      return NextResponse.json({ incidentId, callSid: call.sid });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      if (persisted) {
        await updateIncident(incidentId, { status: 'resolved', resolvedAt: new Date().toISOString(), statusReason: 'failed' });
      }
      logEvent({ event: 'call_failed', route: '/api/hotline/activate', incidentId, wolfId: user?.wolfId || 'WOLF-DEV-TEST', error: msg, bypass: authBypass }, 'error');
      return NextResponse.json({ error: 'Call initiation failed' }, { status: 502 });
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    logEvent({ event: 'hotline_activate_exception', route: '/api/hotline/activate', error: msg }, 'error');
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}


