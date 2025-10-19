import { NextRequest, NextResponse } from 'next/server';
import { getEnv } from '@/lib/env';
import { getOperatorNumber } from '@/lib/operator';
import { getRedis } from '@/lib/redis';
import { logEvent } from '@/lib/log';

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
          const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n  <Pause length="1"/>\n  <Hangup/>\n</Response>`;
          return new NextResponse(xml, { headers: { 'Content-Type': 'text/xml' } });
        }
      }
    }
  } catch {}

  // Bridge the caller with the operator; always provide absolute callback URLs
  const base = env.PUBLIC_BASE_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
  const statusCb = ` statusCallback=\"${base}/api/twilio/call-status\" statusCallbackEvent=\"initiated ringing answered in-progress completed busy no-answer failed canceled\" statusCallbackMethod=\"POST\"`;
  const xml = `<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<Response>\n  <Dial answerOnBridge=\"true\" callerId=\"${env.TWILIO_FROM_NUMBER ?? ''}\"${statusCb}>${operator}</Dial>\n</Response>`;
  return new NextResponse(xml, { headers: { 'Content-Type': 'text/xml' } });
}

export async function POST(req: NextRequest) {
  const env = getEnv();
  const operator = getOperatorNumber();
  const callSid = new URL(req.url).searchParams.get('CallSid') || '';

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
      }
    }
  } catch {}

  const base2 = env.PUBLIC_BASE_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
  const statusCb2 = ` statusCallback=\"${base2}/api/twilio/call-status\" statusCallbackEvent=\"initiated ringing answered in-progress completed busy no-answer failed canceled\" statusCallbackMethod=\"POST\"`;
  const xml = `<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<Response>\n  <Dial answerOnBridge=\"true\" callerId=\"${env.TWILIO_FROM_NUMBER ?? ''}\"${statusCb2}>${operator}</Dial>\n</Response>`;
  return new NextResponse(xml, { headers: { 'Content-Type': 'text/xml' } });
}


