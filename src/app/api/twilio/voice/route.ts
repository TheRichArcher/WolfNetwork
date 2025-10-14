import { NextResponse } from 'next/server';
import { getEnv } from '@/lib/env';
import { getOperatorNumber } from '@/lib/operator';

export async function GET() {
  const env = getEnv();
  const operator = getOperatorNumber();

  if (!operator) {
    // If no operator configured, keep the call alive briefly and then end, to avoid immediate hangup bounce
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n  <Pause length="2"/>\n  <Say>Hotline activated. Help is on the way.</Say>\n  <Pause length="1"/>\n  <Hangup/>\n</Response>`;
    return new NextResponse(xml, { headers: { 'Content-Type': 'text/xml' } });
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n  <Say>Connecting you to an operator now.</Say>\n  <Dial callerId="${env.TWILIO_FROM_NUMBER ?? ''}">${operator}</Dial>\n</Response>`;
  return new NextResponse(xml, { headers: { 'Content-Type': 'text/xml' } });
}

export async function POST() {
  const env = getEnv();
  const operator = getOperatorNumber();

  if (!operator) {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n  <Pause length="2"/>\n  <Say>Hotline activated. Help is on the way.</Say>\n  <Pause length="1"/>\n  <Hangup/>\n</Response>`;
    return new NextResponse(xml, { headers: { 'Content-Type': 'text/xml' } });
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n  <Say>Connecting you to an operator now.</Say>\n  <Dial callerId="${env.TWILIO_FROM_NUMBER ?? ''}">${operator}</Dial>\n</Response>`;
  return new NextResponse(xml, { headers: { 'Content-Type': 'text/xml' } });
}


