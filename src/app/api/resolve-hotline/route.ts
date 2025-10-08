import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { closeSession } from '@/lib/twilioProxy';
import { updateIncident } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const token = await getToken({ req });
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { sessionSid, incidentId } = (await req.json().catch(() => ({}))) as { sessionSid?: string; incidentId?: string };
    if (!sessionSid || !incidentId) return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });

    await closeSession(sessionSid);
    await updateIncident(incidentId, { status: 'resolved', resolvedAt: new Date().toISOString() });

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}


