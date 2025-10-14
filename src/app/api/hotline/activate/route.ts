import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { findUserBySessionEmail, createIncident, updateIncident } from '@/lib/db';
import { decryptSecret } from '@/lib/crypto';
import { createDirectCall } from '@/lib/twilioCalls';
import { getEnv } from '@/lib/env';
import { logEvent } from '@/lib/log';
import { checkRateLimit } from '@/lib/rateLimit';
import { notifyDiscordOnIncident } from '@/lib/notify';
import { getPresenceForRegion } from '@/lib/incidents';
import { z } from 'zod';
import retry from 'p-retry';

export async function POST(req: NextRequest) {
  try {
    // Validate request body
    const bodySchema = z.object({});
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    await bodySchema.parseAsync(body);

    // Authenticate user via session token
    const token = await getToken({ req });
    const email = typeof token?.email === 'string' ? token.email : undefined;
    const authBypass = process.env.AUTH_DEV_BYPASS === 'true';
    logEvent({ event: 'hotline_activate_request', route: '/api/hotline/activate', authBypass, hasEmail: Boolean(email), incidentsTable: process.env.INCIDENTS_TABLE_NAME || 'incidents' });
    if (!email && !authBypass) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Apply rate limiting to prevent abuse
    if (!await checkRateLimit(`hotline:activate:${email}`, 4)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    // Lookup user and decrypt phone
    const user = email ? await findUserBySessionEmail(email) : null;
    logEvent({ event: 'hotline_user_lookup', route: '/api/hotline/activate', found: Boolean(user), wolfId: user?.wolfId, tier: user?.tier, region: user?.region });
    if (!user && !authBypass) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const toNumber = user?.phoneEncrypted ? decryptSecret(user.phoneEncrypted) : process.env.DEV_CALLER_E164 || '';
    if (!toNumber) return NextResponse.json({ error: 'Phone not configured' }, { status: 400 });

    const env = getEnv();
    const base = env.PUBLIC_BASE_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
    const twimlUrl = `${base}/api/twilio/voice`;

    // Create incident record
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
      logEvent({ event: 'incident_create_success', route: '/api/hotline/activate', incidentId, wolfId: user?.wolfId || 'WOLF-DEV-TEST' });
      // Fire-and-forget Discord notification; do not block activation on failures
      const base = getEnv().PUBLIC_BASE_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
      const presence = await getPresenceForRegion(user?.region || 'LA');
      notifyDiscordOnIncident({
        incident: { id: incidentId, wolfId: user?.wolfId || 'WOLF-DEV-TEST', tier: user?.tier, region: user?.region },
        presence,
        baseUrl: base,
      }).catch(() => {});
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      logEvent({ event: 'incident_create_failed', route: '/api/hotline/activate', error: msg, authBypass, incidentsTable: process.env.INCIDENTS_TABLE_NAME || 'incidents' }, 'error');
      if (authBypass) {
        persisted = false;
      } else {
        throw e;
      }
    }

    // Initiate Twilio call with retries for reliability
    let call;
    try {
      call = await retry(() => createDirectCall(
        toNumber,
        twimlUrl,
      ), {
        retries: 3, // Retry up to 3 times on transient errors
        minTimeout: 1000,
        maxTimeout: 5000,
      });
    } catch (e) {
      if (persisted) {
        await updateIncident(incidentId, { status: 'abandoned', statusReason: 'call_initiation_failed', twilioStatus: 'failed' });
      }
      throw e; // Re-throw to be caught by the outer handler
    }

    if (persisted) {
      await updateIncident(incidentId, { callSid: call.sid });
    }
    logEvent({ event: 'hotline_activated', route: '/api/hotline/activate', incidentId, wolfId: user?.wolfId || 'WOLF-DEV-TEST', callSid: call.sid, authBypass, persisted });
    return NextResponse.json({ incidentId, callSid: call.sid });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    logEvent({ event: 'hotline_activate_exception', route: '/api/hotline/activate', error: msg }, 'error');
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}


