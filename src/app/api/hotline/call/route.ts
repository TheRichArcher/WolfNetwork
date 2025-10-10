import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/lib/env";

type CreateCallBody = {
  to?: string; // E.164 user number; optional – could be inferred later from profile
};

// We avoid adding the Twilio SDK dependency; use REST API directly to keep deps slim
async function createTwilioCall(params: {
  accountSid: string;
  authToken: string;
  from: string;
  to: string;
  twimlUrl: string;
}) {
  const { accountSid, authToken, from, to, twimlUrl } = params;
  const authHeader = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const body = new URLSearchParams({ To: to, From: from, Url: twimlUrl, Method: "POST" });
  const env = getEnv();
  const callbackUrl = env.PUBLIC_BASE_URL ? `${env.PUBLIC_BASE_URL}/api/twilio/call-status` : '';
  if (callbackUrl) {
    body.set('StatusCallback', callbackUrl);
    body.set('StatusCallbackMethod', 'POST');
    body.set('StatusCallbackEvent', 'initiated ringing answered completed');
  }
  const resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${authHeader}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    // Twilio can be slow; allow generous timeout via node fetch defaults
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Twilio create call failed (${resp.status}): ${text}`);
  }
  return resp.json();
}

export async function POST(req: NextRequest) {
  try {
    const env = getEnv();
    const json = (await req.json().catch(() => ({}))) as CreateCallBody;

    const accountSid = env.TWILIO_ACCOUNT_SID!;
    const authToken = env.TWILIO_AUTH_TOKEN!;
    const fromNumber = env.TWILIO_FROM_NUMBER!;

    if (!accountSid || !authToken || !fromNumber) {
      return NextResponse.json({ error: "Twilio env vars missing" }, { status: 500 });
    }

    const toNumber = (json.to || "").trim();
    if (!toNumber) {
      return NextResponse.json({ error: "Missing 'to' phone number" }, { status: 400 });
    }

    // Build absolute URL for our TwiML endpoint
    const base = env.PUBLIC_BASE_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
    const twimlUrl = `${base}/api/hotline/twiml`;

    const call = await createTwilioCall({
      accountSid,
      authToken,
      from: fromNumber,
      to: toNumber,
      twimlUrl,
    });

    // Very naive ETA placeholder until we can read Twilio queue or partner dispatch
    return NextResponse.json({
      success: true,
      callSid: call.sid,
      status: call.status,
      etaMinutes: 2,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}


