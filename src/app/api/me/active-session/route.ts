import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { getActiveIncidentForEmail } from '@/lib/incidents';
import { updateIncident } from '@/lib/db';
import { logEvent } from '@/lib/log';

export async function GET(req: NextRequest) {
  const token = await getToken({ req });
  const email = typeof token?.email === 'string' ? token.email : undefined;
  if (!email) return NextResponse.json({ active: false });

  const incident = await getActiveIncidentForEmail(email);
  if (!incident) return NextResponse.json({ active: false });

  // Lazy cleanup: resolve stale initiated incidents after 30 minutes
  if (incident.status === 'initiated') {
    const created = new Date(incident.createdAt).getTime();
    const ageMs = Date.now() - (isNaN(created) ? Date.now() : created);
    if (ageMs > 30 * 60 * 1000) {
      await updateIncident(incident.id, { status: 'resolved', resolvedAt: new Date().toISOString(), statusReason: 'timeout' });
      logEvent({ event: 'incident_timeout_resolve', route: '/api/me/active-session', incidentId: incident.id });
      return NextResponse.json({ active: false });
    }
  }

  const startedAt = incident.createdAt;
  const operator = incident.operatorId || 'Operator';
  return NextResponse.json({
    active: incident.status === 'active' || incident.status === 'initiated',
    status: incident.status,
    sessionSid: incident.sessionSid,
    callSid: (incident as any).callSid || undefined,
    incidentId: incident.id,
    operator,
    startedAt,
  });
}


