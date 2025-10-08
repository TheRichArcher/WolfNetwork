import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { decryptSecret } from '@/lib/crypto';
import { createIncident, findUserBySessionEmail } from '@/lib/db';
import { addParticipant, createProxySession } from '@/lib/twilioProxy';
import { checkRateLimit } from '@/lib/rateLimit';
import { getEnv } from '@/lib/env';

export async function POST(req: NextRequest) {
  try {
    const token = await getToken({ req });
    const email = typeof token?.email === 'string' ? token.email : undefined;
    if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Basic rate limit per user
    if (!checkRateLimit(`hotline:${email}`)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const user = await findUserBySessionEmail(email);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const memberNumber = decryptSecret(user.phoneEncrypted);
    const wolfId = user.wolfId;
    const tier = user.tier;
    const region = user.region;

    // Create Proxy session and participants
    const sessionResp = await createProxySession({ uniqueName: `hotline-${wolfId}-${Date.now()}`, ttlHours: 24 });
    await addParticipant({ sessionSid: sessionResp.sid, identifier: memberNumber, friendlyName: wolfId });
    const env = getEnv();
    const operatorNumber = env.TWILIO_OPERATOR_NUMBER;
    if (operatorNumber) {
      await addParticipant({ sessionSid: sessionResp.sid, identifier: operatorNumber, friendlyName: 'Operator' });
    }

    // Create incident record
    const incident = await createIncident({
      id: crypto.randomUUID(),
      wolfId,
      sessionSid: sessionResp.sid,
      status: 'initiated',
      createdAt: new Date().toISOString(),
      tier,
      region,
    });

    // TODO: emit to operator dashboard via websocket or webhook (n8n or internal bus)

    return NextResponse.json({ sessionSid: sessionResp.sid, wolfId, status: 'initiated', incidentId: incident.id });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}


