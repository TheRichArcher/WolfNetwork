import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { getOperatorNumber } from "@/lib/operator";

export async function GET() {
  const env = getEnv();
  const operator = getOperatorNumber();

  if (!operator) {
    const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Joanna">Wolf hotline cannot connect. Operator number missing.</Say></Response>`;
    return new NextResponse(xml, { status: 500, headers: { "Content-Type": "text/xml" } });
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Wolf connected. Hold for elite match.</Say>
  <Dial callerId="${env.TWILIO_FROM_NUMBER ?? ""}">${operator}</Dial>
</Response>`;

  return new NextResponse(xml, { headers: { "Content-Type": "text/xml" } });
}

export async function POST() {
  const env = getEnv();
  const operator = getOperatorNumber();

  if (!operator) {
    const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Joanna">Wolf hotline cannot connect. Operator number missing.</Say></Response>`;
    return new NextResponse(xml, { status: 500, headers: { "Content-Type": "text/xml" } });
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Wolf connected. Hold for elite match.</Say>
  <Dial callerId="${env.TWILIO_FROM_NUMBER ?? ""}">${operator}</Dial>
</Response>`;

  return new NextResponse(xml, { headers: { "Content-Type": "text/xml" } });
}


