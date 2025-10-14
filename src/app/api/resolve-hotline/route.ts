import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { endCall } from '@/lib/twilioCalls';
import { findIncidentById } from '@/lib/db';
import { resolveIncident } from '@/lib/incidents';
import { logEvent } from '@/lib/log';

export async function POST(req: NextRequest) {
  try {
    const token = await getToken({ req });
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { incidentId } = (await req.json().catch(() => ({}))) as { incidentId?: string };
    if (!incidentId) return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });

    const incident = await findIncidentById(incidentId);
    if (!incident) return NextResponse.json({ error: 'Incident not found' }, { status: 404 });
    if (incident.resolvedAt && incident.resolvedAt.length > 0) return NextResponse.json({ success: true });

    try {
      if (incident.callSid) {
        await endCall(incident.callSid);
      }
    } catch (e: unknown) {
      // Ignore failures here; proceed to mark resolved
      logEvent({ event: 'end_call_failed', route: '/api/resolve-hotline', incidentId, error: e instanceof Error ? e.message : String(e) }, 'warn');
    }

    const terminalStatus: 'resolved' | 'pending_followup' | 'abandoned' = incident.operatorId ? 'resolved' : 'pending_followup';
    await resolveIncident({ incidentId: incident.id, status: terminalStatus, twilioStatus: incident.twilioStatus || 'manual', statusReason: 'manual' });
    logEvent({ event: 'incident_resolved_manual', route: '/api/resolve-hotline', incidentId: incident.id, wolfId: incident.wolfId, terminalStatus });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}


