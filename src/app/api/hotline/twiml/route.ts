import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { getOperatorNumber } from "@/lib/operator";
import { findIncidentByCallSid } from '@/lib/db';
import { getRedis } from '@/lib/redis';
import { logEvent } from '@/lib/log';
const memoryLocks = new Set<string>();

async function readFormParams(req: NextRequest): Promise<URLSearchParams> {
  const contentType = req.headers.get('content-type') || '';
  if (contentType.includes('application/x-www-form-urlencoded')) {
    const text = await req.text();
    return new URLSearchParams(text);
  }
  if (contentType.includes('application/json')) {
    const json = await req.json().catch(() => ({}));
    return new URLSearchParams(Object.entries(json).map(([k, v]) => [k, String(v ?? '')]));
  }
  return new URLSearchParams();
}

export async function GET(req: NextRequest) {
  const env = getEnv();
  const callSid = new URL(req.url).searchParams.get('CallSid') || '';
  let operatorPhone = env.TWILIO_OPERATOR_NUMBER ?? '';
  if (callSid) {
    const incident = await findIncidentByCallSid(callSid);
    if (incident?.operatorPhone) operatorPhone = incident.operatorPhone;
  }
  if (!operatorPhone) {
    const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Pause length="1"/><Hangup/></Response>`;
    return new NextResponse(xml, { status: 500, headers: { "Content-Type": "text/xml" } });
  }
  // Idempotency: prevent duplicate Dial execution for same CallSid
  try {
    if (callSid) {
      const redis = getRedis();
      if (redis) {
        const set = await redis.set(`twiml:dial:${callSid}`, '1', 'EX', 180, 'NX');
        if (set !== 'OK') {
          logEvent({ event: 'twiml_dial_skipped_duplicate', route: '/api/hotline/twiml', callSid });
          const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n  <Pause length="1"/>\n  <Hangup/>\n</Response>`;
          return new NextResponse(xml, { headers: { "Content-Type": "text/xml" } });
        }
      } else {
        if (memoryLocks.has(callSid)) {
          logEvent({ event: 'twiml_dial_skipped_duplicate_mem', route: '/api/hotline/twiml', callSid });
          const xml = `<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<Response>\n  <Pause length=\"1\"/>\n  <Hangup/>\n</Response>`;
          return new NextResponse(xml, { headers: { "Content-Type": "text/xml" } });
        }
        memoryLocks.add(callSid);
        setTimeout(() => memoryLocks.delete(callSid), 180000).unref?.();
      }
    }
  } catch {}

  // Build absolute StatusCallback URL for Twilio callbacks; fall back to incoming request host
  const base = env.PUBLIC_BASE_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
  const statusCb = `${base}/api/twilio/call-status`;
  const callerIdAttr = env.TWILIO_FROM_NUMBER && env.TWILIO_FROM_NUMBER.length > 0 ? ` callerId="${env.TWILIO_FROM_NUMBER}"` : '';
  const events = 'initiated ringing answered completed';
  logEvent({ event: 'twiml_dial_config', route: '/api/hotline/twiml', operatorPhone, base });
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n  <Dial answerOnBridge="true"${callerIdAttr} statusCallback="${statusCb}" statusCallbackEvent="${events}" statusCallbackMethod="POST">${operatorPhone}</Dial>\n</Response>`;

  return new NextResponse(xml, { headers: { "Content-Type": "text/xml" } });
}

export async function POST(req: NextRequest) {
  const env = getEnv();
  // Twilio posts CallSid in the x-www-form-urlencoded body for POST TwiML requests
  const urlCallSid = new URL(req.url).searchParams.get('CallSid') || '';
  const formParams = await readFormParams(req);
  const bodyCallSid = formParams.get('CallSid') || '';
  const callSid = urlCallSid || bodyCallSid;
  let operatorPhone = env.TWILIO_OPERATOR_NUMBER ?? getOperatorNumber() ?? '';
  if (callSid) {
    const incident = await findIncidentByCallSid(callSid);
    if (incident?.operatorPhone) operatorPhone = incident.operatorPhone;
  }
  if (!operatorPhone) {
    const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Pause length="1"/><Hangup/></Response>`;
    return new NextResponse(xml, { status: 500, headers: { "Content-Type": "text/xml" } });
  }
  // Idempotency: prevent duplicate Dial execution for same CallSid
  try {
    if (callSid) {
      const redis = getRedis();
      if (redis) {
        const set = await redis.set(`twiml:dial:${callSid}`, '1', 'EX', 180, 'NX');
        if (set !== 'OK') {
          logEvent({ event: 'twiml_dial_skipped_duplicate', route: '/api/hotline/twiml', callSid });
          const xml = `<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<Response>\n  <Pause length=\"1\"/>\n  <Hangup/>\n</Response>`;
          return new NextResponse(xml, { headers: { "Content-Type": "text/xml" } });
        }
      } else {
        if (memoryLocks.has(callSid)) {
          logEvent({ event: 'twiml_dial_skipped_duplicate_mem', route: '/api/hotline/twiml', callSid });
          const xml = `<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<Response>\n  <Pause length=\"1\"/>\n  <Hangup/>\n</Response>`;
          return new NextResponse(xml, { headers: { "Content-Type": "text/xml" } });
        }
        memoryLocks.add(callSid);
        setTimeout(() => memoryLocks.delete(callSid), 180000).unref?.();
      }
    }
  } catch {}

  const base2 = env.PUBLIC_BASE_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
  const statusCb2 = `${base2}/api/twilio/call-status`;
  const callerIdAttr2 = env.TWILIO_FROM_NUMBER && env.TWILIO_FROM_NUMBER.length > 0 ? ` callerId="${env.TWILIO_FROM_NUMBER}"` : '';
  const events2 = 'initiated ringing answered completed';
  logEvent({ event: 'twiml_dial_config', route: '/api/hotline/twiml', operatorPhone, base: base2 });
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n  <Dial answerOnBridge="true"${callerIdAttr2} statusCallback="${statusCb2}" statusCallbackEvent="${events2}" statusCallbackMethod="POST">${operatorPhone}</Dial>\n</Response>`;
  return new NextResponse(xml, { headers: { "Content-Type": "text/xml" } });
}


