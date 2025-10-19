import { NextRequest, NextResponse } from 'next/server';
import { getEnv } from '@/lib/env';
import { getOperatorNumber } from '@/lib/operator';
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
  const operator = getOperatorNumber();
  const callSid = new URL(req.url).searchParams.get('CallSid') || '';

  if (!operator) {
    // If no operator configured, end cleanly with a brief pause to avoid bounce loops
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n  <Pause length="1"/>\n  <Hangup/>\n</Response>`;
    return new NextResponse(xml, { headers: { 'Content-Type': 'text/xml' } });
  }

  // Idempotency: prevent duplicate Dial execution for same CallSid
  try {
    if (callSid) {
      const redis = getRedis();
      if (redis) {
        const set = await redis.set(`twiml:dial:${callSid}`, '1', 'EX', 180, 'NX');
        if (set !== 'OK') {
          logEvent({ event: 'twiml_dial_skipped_duplicate', route: '/api/twilio/voice', callSid });
          const xml = `<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<Response>\n  <Pause length=\"1\"/>\n  <Hangup/>\n</Response>`;
          return new NextResponse(xml, { headers: { 'Content-Type': 'text/xml' } });
        }
      } else {
        if (memoryLocks.has(callSid)) {
          logEvent({ event: 'twiml_dial_skipped_duplicate_mem', route: '/api/twilio/voice', callSid });
          const xml = `<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<Response>\n  <Pause length=\"1\"/>\n  <Hangup/>\n</Response>`;
          return new NextResponse(xml, { headers: { 'Content-Type': 'text/xml' } });
        }
        memoryLocks.add(callSid);
        setTimeout(() => memoryLocks.delete(callSid), 180000).unref?.();
      }
    }
  } catch {}

  // Bridge the caller with the operator; always provide absolute callback URLs
  const base = env.PUBLIC_BASE_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
  logEvent({ event: 'twiml_dial_config', route: '/api/twilio/voice', operator, base });
  const events = 'initiated ringing answered completed';
  const statusCb = ` statusCallback=\"${base}/api/twilio/call-status\" statusCallbackEvent=\"${events}\" statusCallbackMethod=\"POST\"`;
  const callerIdAttr = env.TWILIO_FROM_NUMBER && env.TWILIO_FROM_NUMBER.length > 0 ? ` callerId=\"${env.TWILIO_FROM_NUMBER}\"` : '';
  const xml = `<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<Response>\n  <Dial answerOnBridge=\"true\"${callerIdAttr}${statusCb}>${operator}</Dial>\n</Response>`;
  return new NextResponse(xml, { headers: { 'Content-Type': 'text/xml' } });
}

export async function POST(req: NextRequest) {
  const env = getEnv();
  const operator = getOperatorNumber();
  const urlCallSid = new URL(req.url).searchParams.get('CallSid') || '';
  const formParams = await readFormParams(req);
  const bodyCallSid = formParams.get('CallSid') || '';
  const callSid = urlCallSid || bodyCallSid;

  if (!operator) {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n  <Pause length="1"/>\n  <Hangup/>\n</Response>`;
    return new NextResponse(xml, { headers: { 'Content-Type': 'text/xml' } });
  }

  // Idempotency: prevent duplicate Dial execution for same CallSid
  try {
    if (callSid) {
      const redis = getRedis();
      if (redis) {
        const set = await redis.set(`twiml:dial:${callSid}`, '1', 'EX', 180, 'NX');
        if (set !== 'OK') {
          logEvent({ event: 'twiml_dial_skipped_duplicate', route: '/api/twilio/voice', callSid });
          const xml = `<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<Response>\n  <Pause length=\"1\"/>\n  <Hangup/>\n</Response>`;
          return new NextResponse(xml, { headers: { 'Content-Type': 'text/xml' } });
        }
      } else {
        if (memoryLocks.has(callSid)) {
          logEvent({ event: 'twiml_dial_skipped_duplicate_mem', route: '/api/twilio/voice', callSid });
          const xml = `<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<Response>\n  <Pause length=\"1\"/>\n  <Hangup/>\n</Response>`;
          return new NextResponse(xml, { headers: { 'Content-Type': 'text/xml' } });
        }
        memoryLocks.add(callSid);
        setTimeout(() => memoryLocks.delete(callSid), 180000).unref?.();
      }
    }
  } catch {}

  const base2 = env.PUBLIC_BASE_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
  logEvent({ event: 'twiml_dial_config', route: '/api/twilio/voice', operator, base: base2 });
  const events2 = 'initiated ringing answered completed';
  const statusCb2 = ` statusCallback=\"${base2}/api/twilio/call-status\" statusCallbackEvent=\"${events2}\" statusCallbackMethod=\"POST\"`;
  const callerIdAttr2 = env.TWILIO_FROM_NUMBER && env.TWILIO_FROM_NUMBER.length > 0 ? ` callerId=\"${env.TWILIO_FROM_NUMBER}\"` : '';
  const xml = `<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<Response>\n  <Dial answerOnBridge=\"true\"${callerIdAttr2}${statusCb2}>${operator}</Dial>\n</Response>`;
  return new NextResponse(xml, { headers: { 'Content-Type': 'text/xml' } });
}


