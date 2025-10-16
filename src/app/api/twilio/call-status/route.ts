import { NextRequest, NextResponse } from 'next/server';
import { verifyTwilioSignature } from '@/lib/twilioWebhook';
import { findIncidentByCallSid } from '@/lib/db';
import { resolveIncident } from '@/lib/incidents';
import { logEvent } from '@/lib/log';

function mapToAction(status: string): { kind: 'activate' } | { kind: 'resolve'; status: 'resolved' | 'abandoned' | 'missed' | 'pending_followup' } | null {
  const s = status.toLowerCase();
  if (s === 'in-progress' || s === 'answered' || s === 'ringing' || s === 'initiated' || s === 'queued') return { kind: 'activate' };
  if (s === 'completed') return { kind: 'resolve', status: 'resolved' };
  if (s === 'busy') return { kind: 'resolve', status: 'missed' };
  if (s === 'no-answer' || s === 'failed' || s === 'canceled') return { kind: 'resolve', status: 'abandoned' };
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const url = req.nextUrl;
    const xSig = req.headers.get('x-twilio-signature');
    const contentType = req.headers.get('content-type') || '';
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

    const fullUrl = `${process.env.PUBLIC_BASE_URL || `${url.protocol}//${url.host}`}${url.pathname}`;
    // Allow signature bypass in non-production for local/dev testing to ensure cleanup flows work
    const sigOk = verifyTwilioSignature({ fullUrl, xSignature: xSig, formParams: params });
    if (!sigOk && process.env.NODE_ENV === 'production' && process.env.TWILIO_SIGNATURE_BYPASS !== 'true') {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const callSid = params.get('CallSid') || '';
    // Support both parent CallStatus and DialCallStatus from <Dial action="...">
    const statusPrimary = (params.get('CallStatus') || '').toLowerCase();
    const statusDial = (params.get('DialCallStatus') || '').toLowerCase();
    const callStatus = statusPrimary || statusDial;
    const from = params.get('From') || '';
    const to = params.get('To') || '';
    const dur = params.get('CallDuration') || '';
    logEvent({ event: 'call_status_raw', route: '/api/twilio/call-status', callSid, callStatus, from, to, duration: dur });
    if (!callSid) return NextResponse.json({ ok: true });

    const incident = await findIncidentByCallSid(callSid);
    if (!incident) {
      // Nothing to update yet; log and accept
      logEvent({ event: 'call_status_orphan', route: '/api/twilio/call-status', callSid, callStatus });
      return NextResponse.json({ ok: true });
    }

    const action = mapToAction(callStatus);
    if (action?.kind === 'activate') {
      // Mark active without resolving
      await (async () => {
        try {
          // activation update inline to avoid new helper; keep fields lowercased
          const now = new Date().toISOString();
          const dur = params.get('CallDuration');
          const durationSeconds = dur && /^\d+$/.test(dur) ? Number(dur) : undefined;
          // Use updateIncident via dynamic import to avoid circulars
          const { updateIncident } = await import('@/lib/db');
          await updateIncident(incident.id, {
            status: 'active',
            activatedAt: now,
            twilioStatus: callStatus,
            ...(typeof durationSeconds === 'number' ? { durationSeconds } : {}),
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          logEvent({ event: 'activate_incident_error', route: '/api/twilio/call-status', incidentId: incident.id, error: msg }, 'warn');
        }
      })();
    } else if (action?.kind === 'resolve') {
      const dur = params.get('CallDuration');
      const durationSeconds = dur && /^\d+$/.test(dur) ? Number(dur) : undefined;
      await resolveIncident({
        incidentId: incident.id,
        status: action.status,
        twilioStatus: callStatus,
        statusReason: callStatus,
        ...(typeof durationSeconds === 'number' ? { durationSeconds } : {}),
      });
    }
    logEvent({ event: 'call_status', route: '/api/twilio/call-status', incidentId: incident.id, wolfId: incident.wolfId, callSid, callStatus });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}


