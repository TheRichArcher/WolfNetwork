import { getEnv } from './env';
import { logEvent } from './log';

export type CreateCallResult = { sid: string; status?: string };

function resolveBaseUrl(): string | undefined {
  const env = getEnv();
  const candidates = [
    env.PUBLIC_BASE_URL,
    process.env.RENDER_EXTERNAL_URL,
    process.env.NEXTAUTH_URL,
    process.env.SITE_URL,
    process.env.URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
  ].filter(Boolean) as string[];
  const first = candidates.find((u) => /^https?:\/\//i.test(u));
  return first;
}

export async function createDirectCall(toE164: string, twimlUrl: string, opts?: { idempotencyKey?: string }): Promise<CreateCallResult> {
  const env = getEnv();
  const accountSid = env.TWILIO_ACCOUNT_SID || '';
  const authToken = env.TWILIO_AUTH_TOKEN || '';
  const fromNumber = env.TWILIO_FROM_NUMBER || '';
  if (!accountSid || !authToken || !fromNumber) throw new Error('Twilio env vars missing');
  const authHeader = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
  const body = new URLSearchParams({ To: toE164, From: fromNumber, Url: twimlUrl, Method: 'POST' });
  // Wire Twilio status callbacks when a base URL is available
  const baseUrl = resolveBaseUrl();
  const callbackUrl = baseUrl ? `${baseUrl}/api/twilio/call-status` : '';
  if (callbackUrl) {
    body.set('StatusCallback', callbackUrl);
    body.set('StatusCallbackMethod', 'POST');
    // Ask Twilio to notify for all key lifecycle events we use in UI/state
    body.set('StatusCallbackEvent', 'initiated ringing answered in-progress completed busy no-answer failed canceled');
  }
  try {
    logEvent({ event: 'twilio_create_call', toE164, twimlUrl, callbackUrl, idempotencyKey: opts?.idempotencyKey || undefined });
  } catch {}
  const headers: Record<string, string> = { Authorization: `Basic ${authHeader}`, 'Content-Type': 'application/x-www-form-urlencoded' };
  if (opts?.idempotencyKey) {
    headers['Idempotency-Key'] = opts.idempotencyKey;
  }
  const resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`, {
    method: 'POST',
    headers,
    body,
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Twilio create call failed (${resp.status}): ${text}`);
  }
  return resp.json();
}

export async function endCall(callSid: string): Promise<void> {
  const env = getEnv();
  const accountSid = env.TWILIO_ACCOUNT_SID || '';
  const authToken = env.TWILIO_AUTH_TOKEN || '';
  if (!accountSid || !authToken) throw new Error('Twilio env vars missing');
  const authHeader = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
  const body = new URLSearchParams({ Status: 'completed' });
  const resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls/${callSid}.json`, {
    method: 'POST',
    headers: { Authorization: `Basic ${authHeader}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!resp.ok && resp.status !== 404) {
    const text = await resp.text();
    throw new Error(`Twilio end call failed (${resp.status}): ${text}`);
  }
}



