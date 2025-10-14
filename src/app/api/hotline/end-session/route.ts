import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { findIncidentById, findIncidentByCallSid, updateIncident } from '@/lib/db';
import { endCall } from '@/lib/twilioCalls';
import { logEvent } from '@/lib/log';

export async function POST(req: NextRequest) {
  try {
    const token = await getToken({ req });
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { incidentId, callSid } = (await req.json().catch(() => ({}))) as { incidentId?: string; callSid?: string };
    if (!incidentId && !callSid) return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });

    const incident = incidentId ? await findIncidentById(incidentId) : callSid ? await findIncidentByCallSid(callSid) : null;
    if (!incident) return NextResponse.json({ error: 'Incident not found' }, { status: 404 });
    if (incident.status === 'resolved') return NextResponse.json({ success: true });

    try {
      if (incident.callSid) await endCall(incident.callSid);
    } catch (e: unknown) {
      logEvent({ event: 'end_call_failed', route: '/api/hotline/end-session', incidentId: incident.id, error: e instanceof Error ? e.message : String(e) }, 'warn');
    }

    await updateIncident(incident.id, { status: 'resolved', resolvedAt: new Date().toISOString(), statusReason: 'manual' });
    logEvent({ event: 'incident_resolved_manual', route: '/api/hotline/end-session', incidentId: incident.id, wolfId: incident.wolfId });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}


