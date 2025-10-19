import { NextRequest, NextResponse } from 'next/server';
import { verifyTwilioSignature } from '@/lib/twilioWebhook';
import { getEnv } from '@/lib/env';
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

    // IMPORTANT: Twilio signature must be computed with the exact public URL Twilio POSTed to.
    // Prefer PUBLIC_BASE_URL when set; else use X-Forwarded headers; else fall back to nextUrl.
    const env = getEnv();
    const xfProto = req.headers.get('x-forwarded-proto');
    const xfHost = req.headers.get('x-forwarded-host');
    // Prefer X-Forwarded headers (actual public host Twilio hit), then PUBLIC_BASE_URL, then local nextUrl
    const base = (xfProto && xfHost ? `${xfProto}://${xfHost}` : '')
      || (env.PUBLIC_BASE_URL && /^https?:\/\//i.test(env.PUBLIC_BASE_URL) ? env.PUBLIC_BASE_URL : '')
      || `${url.protocol}//${url.host}`;
    const fullUrl = `${base}${url.pathname}${url.search || ''}`;
    // Enforce signature verification in production; in non-production, allow bypass for local/dev testing
    const sigOk = verifyTwilioSignature({ fullUrl, xSignature: xSig, formParams: params });
    if (process.env.NODE_ENV === 'production' && !sigOk) {
      logEvent({ event: 'twilio_sig_invalid', route: '/api/twilio/call-status', computedUrl: fullUrl }, 'warn');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const callSidRaw = params.get('CallSid') || '';
    const dialCallSid = params.get('DialCallSid') || '';
    // When <Dial> bridges a call, status events may arrive with child CallSid while our incident stored parent SID.
    // Prefer CallSid, but fall back to ParentCallSid to locate the incident.
    const parentSid = params.get('ParentCallSid') || '';
    const callSid = callSidRaw || parentSid;
    // Support both parent CallStatus and DialCallStatus from <Dial action="...">
    const statusPrimary = (params.get('CallStatus') || '').toLowerCase();
    const statusDial = (params.get('DialCallStatus') || '').toLowerCase();
    const callStatus = statusPrimary || statusDial;
    const from = params.get('From') || '';
    const to = params.get('To') || '';
    const dur = params.get('CallDuration') || '';
    // Detailed logging to help correlate parent/child SIDs and duplicate events
    logEvent({
      event: 'call_status_raw',
      route: '/api/twilio/call-status',
      callSid,
      callSidRaw,
      parentSid,
      dialCallSid,
      callStatus,
      from,
      to,
      duration: dur,
    });
    if (!callSid) return NextResponse.json({ ok: true });

    // Try all relevant SIDs: parent call, direct CallSid, and Dial child
    let incident = await findIncidentByCallSid(callSid);
    if (!incident && parentSid && parentSid !== callSidRaw) {
      incident = await findIncidentByCallSid(parentSid);
    }
    if (!incident && dialCallSid) {
      incident = await findIncidentByCallSid(dialCallSid);
    }
    // As a last resort during activation race, try to attach to the newest initiated incident without callSid
    if (!incident && (callStatus === 'initiated' || callStatus === 'ringing' || callStatus === 'answered')) {
      try {
        const { findRecentInitiatedIncidentWithoutCallSid } = await import('@/lib/db');
        const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const maybe = await findRecentInitiatedIncidentWithoutCallSid(since);
        if (maybe) {
          // Attach the callSid for future updates
          const { updateIncident } = await import('@/lib/db');
          await updateIncident(maybe.id, { callSid: callSidRaw || parentSid });
          incident = maybe;
        }
      } catch {}
    }
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
          const durPrimary = params.get('CallDuration');
          const durDial = params.get('DialCallDuration');
          const dur = durPrimary || durDial;
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
      const durPrimary = params.get('CallDuration');
      const durDial = params.get('DialCallDuration');
      const dur = durPrimary || durDial;
      const durationSeconds = dur && /^\d+$/.test(dur) ? Number(dur) : undefined;
      logEvent({ event: 'incident_resolving', route: '/api/twilio/call-status', incidentId: incident.id, finalStatus: action.status, twilioStatus: callStatus, durationSeconds });
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


