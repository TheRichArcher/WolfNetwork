import { NextRequest, NextResponse } from 'next/server';
import { getEnv } from '@/lib/env';
import { getOperatorNumber } from '@/lib/operator';

export async function GET(req: NextRequest) {
  const env = getEnv();
  const operator = getOperatorNumber();

  if (!operator) {
    // If no operator configured, end cleanly with a brief pause to avoid bounce loops
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n  <Pause length="1"/>\n  <Hangup/>\n</Response>`;
    return new NextResponse(xml, { headers: { 'Content-Type': 'text/xml' } });
  }

  // Bridge the caller with the operator; always provide absolute callback URLs
  const base = env.PUBLIC_BASE_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
  const statusCb = ` statusCallback=\"${base}/api/twilio/call-status\" statusCallbackEvent=\"initiated ringing answered in-progress completed busy no-answer failed canceled\" statusCallbackMethod=\"POST\"`;
  const xml = `<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<Response>\n  <Dial answerOnBridge=\"true\" callerId=\"${env.TWILIO_FROM_NUMBER ?? ''}\"${statusCb}>${operator}</Dial>\n</Response>`;
  return new NextResponse(xml, { headers: { 'Content-Type': 'text/xml' } });
}

export async function POST(req: NextRequest) {
  const env = getEnv();
  const operator = getOperatorNumber();

  if (!operator) {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n  <Pause length="1"/>\n  <Hangup/>\n</Response>`;
    return new NextResponse(xml, { headers: { 'Content-Type': 'text/xml' } });
  }

  const base2 = env.PUBLIC_BASE_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
  const statusCb2 = ` statusCallback=\"${base2}/api/twilio/call-status\" statusCallbackEvent=\"initiated ringing answered in-progress completed busy no-answer failed canceled\" statusCallbackMethod=\"POST\"`;
  const xml = `<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<Response>\n  <Dial answerOnBridge=\"true\" callerId=\"${env.TWILIO_FROM_NUMBER ?? ''}\"${statusCb2}>${operator}</Dial>\n</Response>`;
  return new NextResponse(xml, { headers: { 'Content-Type': 'text/xml' } });
}


