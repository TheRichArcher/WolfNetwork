import { NextRequest, NextResponse } from 'next/server';
import { verifyTwilioSignature } from '@/lib/twilioWebhook';
import { findIncidentByCallSid, updateIncident } from '@/lib/db';
import { logEvent } from '@/lib/log';

function mapToIncidentUpdate(status: string, params: URLSearchParams) {
  const updates: Record<string, unknown> = { twilioStatus: status };
  const now = new Date().toISOString();
  if (status === 'in-progress' || status === 'answered') {
    updates['status'] = 'active';
    updates['activatedAt'] = now;
  } else if (
    status === 'completed' ||
    status === 'busy' ||
    status === 'no-answer' ||
    status === 'failed' ||
    status === 'canceled'
  ) {
    updates['status'] = 'resolved';
    updates['resolvedAt'] = now;
    updates['statusReason'] = status;
    const dur = params.get('CallDuration');
    if (dur && /^\d+$/.test(dur)) updates['durationSeconds'] = Number(dur);
  }
  return updates;
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
    const ok = verifyTwilioSignature({ fullUrl, xSignature: xSig, formParams: params });
    if (!ok) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });

    const callSid = params.get('CallSid') || '';
    const callStatus = (params.get('CallStatus') || '').toLowerCase();
    if (!callSid) return NextResponse.json({ ok: true });

    const incident = await findIncidentByCallSid(callSid);
    if (!incident) {
      // Nothing to update yet; log and accept
      logEvent({ event: 'call_status_orphan', route: '/api/twilio/call-status', callSid, callStatus });
      return NextResponse.json({ ok: true });
    }

    const updates = mapToIncidentUpdate(callStatus, params) as Partial<{
      status: 'initiated' | 'active' | 'resolved';
      activatedAt: string;
      resolvedAt: string;
      statusReason: string;
      twilioStatus: string;
      durationSeconds: number;
    }>;
    if (Object.keys(updates).length > 0) {
      await updateIncident(incident.id, updates);
    }
    logEvent({ event: 'call_status', route: '/api/twilio/call-status', incidentId: incident.id, wolfId: incident.wolfId, callSid, callStatus });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}


