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
  // Include action callback to receive Dial final status even if parent CallStatus doesn't include duration
  const actionUrl = `${env.PUBLIC_BASE_URL || ''}/api/twilio/call-status`;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n  <Dial answerOnBridge="true" callerId="${env.TWILIO_FROM_NUMBER ?? ''}" action="${actionUrl}" method="POST">${operator}</Dial>\n</Response>`;
  return new NextResponse(xml, { headers: { 'Content-Type': 'text/xml' } });
}

export async function POST() {
  const env = getEnv();
  const operator = getOperatorNumber();

  if (!operator) {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n  <Pause length="1"/>\n  <Hangup/>\n</Response>`;
    return new NextResponse(xml, { headers: { 'Content-Type': 'text/xml' } });
  }

  const actionUrl2 = `${env.PUBLIC_BASE_URL || ''}/api/twilio/call-status`;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n  <Dial answerOnBridge="true" callerId="${env.TWILIO_FROM_NUMBER ?? ''}" action="${actionUrl2}" method="POST">${operator}</Dial>\n</Response>`;
  return new NextResponse(xml, { headers: { 'Content-Type': 'text/xml' } });
}


