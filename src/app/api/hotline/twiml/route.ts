import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { getOperatorNumber } from "@/lib/operator";
import { findIncidentByCallSid } from '@/lib/db';

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

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n  <Dial answerOnBridge="true" callerId="${env.TWILIO_FROM_NUMBER ?? ''}">${operatorPhone}</Dial>\n</Response>`;

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
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n  <Dial answerOnBridge="true" callerId="${env.TWILIO_FROM_NUMBER ?? ''}">${operatorPhone}</Dial>\n</Response>`;
  return new NextResponse(xml, { headers: { "Content-Type": "text/xml" } });
}


