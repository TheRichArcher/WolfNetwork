import { NextRequest, NextResponse } from 'next/server';

// Twilio webhook for session events (onParticipantAdded)
export async function POST(req: NextRequest) {
  // Trust Twilio via network controls; optionally verify signature header X-Twilio-Signature here
  const bodyText = await req.text();
  // Mask logs to avoid PII
  console.log('[twilio] session-updated', bodyText.replace(/\+?\d{7,}/g, '[redacted]'));
  return NextResponse.json({ ok: true });
}


