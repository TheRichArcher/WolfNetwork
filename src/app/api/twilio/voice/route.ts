import { NextResponse } from 'next/server';
import { getEnv } from '@/lib/env';
import { getOperatorNumber } from '@/lib/operator';

export async function GET() {
  const env = getEnv();
  const operator = getOperatorNumber();

  if (!operator) {
    // If no operator configured, end cleanly with a brief pause to avoid bounce loops
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n  <Pause length="1"/>\n  <Hangup/>\n</Response>`;
    return new NextResponse(xml, { headers: { 'Content-Type': 'text/xml' } });
  }

  // Bridge the caller with the operator without any pre-roll message
  // Include action callback only when we have an absolute PUBLIC_BASE_URL
  const actionAttr = env.PUBLIC_BASE_URL ? ` action="${env.PUBLIC_BASE_URL}/api/twilio/call-status" method="POST"` : '';
  const xml = `<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<Response>\n  <Dial answerOnBridge=\"true\" callerId=\"${env.TWILIO_FROM_NUMBER ?? ''}\"${actionAttr}>${operator}</Dial>\n</Response>`;
  return new NextResponse(xml, { headers: { 'Content-Type': 'text/xml' } });
}

export async function POST() {
  const env = getEnv();
  const operator = getOperatorNumber();

  if (!operator) {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n  <Pause length="1"/>\n  <Hangup/>\n</Response>`;
    return new NextResponse(xml, { headers: { 'Content-Type': 'text/xml' } });
  }

  const actionAttr2 = env.PUBLIC_BASE_URL ? ` action=\"${env.PUBLIC_BASE_URL}/api/twilio/call-status\" method=\"POST\"` : '';
  const xml = `<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<Response>\n  <Dial answerOnBridge=\"true\" callerId=\"${env.TWILIO_FROM_NUMBER ?? ''}\"${actionAttr2}>${operator}</Dial>\n</Response>`;
  return new NextResponse(xml, { headers: { 'Content-Type': 'text/xml' } });
}


