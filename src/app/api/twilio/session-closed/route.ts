import { NextRequest, NextResponse } from 'next/server';

// Twilio webhook for when a session ends
export async function POST(req: NextRequest) {
  const bodyText = await req.text();
  console.log('[twilio] session-closed', bodyText.replace(/\+?\d{7,}/g, '[redacted]'));
  return NextResponse.json({ ok: true });
}


