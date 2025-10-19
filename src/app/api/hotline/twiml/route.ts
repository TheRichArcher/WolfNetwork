import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { getOperatorNumber } from "@/lib/operator";
import { findIncidentByCallSid } from '@/lib/db';
import { getRedis } from '@/lib/redis';
import { logEvent } from '@/lib/log';

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
      }
    }
  } catch {}

  // Build absolute StatusCallback URL for Twilio callbacks; fall back to incoming request host
  const base = env.PUBLIC_BASE_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
  const statusCb = `${base}/api/twilio/call-status`;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n  <Dial answerOnBridge="true" callerId="${env.TWILIO_FROM_NUMBER ?? ''}" statusCallback="${statusCb}" statusCallbackEvent="initiated ringing answered in-progress completed busy no-answer failed canceled" statusCallbackMethod="POST">${operatorPhone}</Dial>\n</Response>`;

  return new NextResponse(xml, { headers: { "Content-Type": "text/xml" } });
}

export async function POST(req: NextRequest) {
  const env = getEnv();
  const callSid = new URL(req.url).searchParams.get('CallSid') || '';
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
      }
    }
  } catch {}

  const base2 = env.PUBLIC_BASE_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
  const statusCb2 = `${base2}/api/twilio/call-status`;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n  <Dial answerOnBridge="true" callerId="${env.TWILIO_FROM_NUMBER ?? ''}" statusCallback="${statusCb2}" statusCallbackEvent="initiated ringing answered in-progress completed busy no-answer failed canceled" statusCallbackMethod="POST">${operatorPhone}</Dial>\n</Response>`;
  return new NextResponse(xml, { headers: { "Content-Type": "text/xml" } });
}


