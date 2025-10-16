import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { getActiveIncidentForEmail, getActiveIncidentForWolfId } from '@/lib/incidents';
import { updateIncident } from '@/lib/db';
import { logEvent } from '@/lib/log';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const token = await getToken({ req });
    const email = typeof token?.email === 'string' ? token.email : undefined;
    let incident = null as Awaited<ReturnType<typeof getActiveIncidentForEmail>> | Awaited<ReturnType<typeof getActiveIncidentForWolfId>> | null;
    if (email) {
      incident = await getActiveIncidentForEmail(email);
    } else if (process.env.AUTH_DEV_BYPASS === 'true') {
      const wolfId = process.env.DEV_WOLF_ID || 'WOLF-DEV-1234';
      incident = await getActiveIncidentForWolfId(wolfId);
    } else {
      return NextResponse.json({ active: false });
    }
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
    const twilioStatus = (incident as unknown as { twilioStatus?: string }).twilioStatus || undefined;
    const s = String(twilioStatus || '').toLowerCase();
    const terminal = s === 'completed' || s === 'busy' || s === 'no-answer' || s === 'failed' || s === 'canceled';
    const inProgress = s === 'queued' || s === 'initiated' || s === 'ringing' || s === 'in-progress' || s === 'answered';
    // Only report active when Twilio indicates an in-progress state, or backend explicitly marked 'active'
    const derivedActive = !terminal && (incident.status === 'active' || inProgress);
    return NextResponse.json({
      active: derivedActive,
      status: incident.status,
      sessionSid: incident.sessionSid,
      callSid: (incident as unknown as { callSid?: string }).callSid || undefined,
      incidentId: incident.id,
      wolfId: incident.wolfId,
      operator,
      startedAt,
      twilioStatus,
      durationSeconds: (incident as unknown as { durationSeconds?: number }).durationSeconds || undefined,
      isTerminal: terminal,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logEvent({ event: 'active_session_error', error: msg });
    // Do not surface 500 to client; return inactive to keep UI resilient
    return NextResponse.json({ active: false });
  }
}


