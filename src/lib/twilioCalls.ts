import { getEnv } from './env';

export type CreateCallResult = { sid: string; status?: string };

export async function createDirectCall(toE164: string, twimlUrl: string): Promise<CreateCallResult> {
  const env = getEnv();
  const accountSid = env.TWILIO_ACCOUNT_SID || '';
  const authToken = env.TWILIO_AUTH_TOKEN || '';
  const fromNumber = env.TWILIO_FROM_NUMBER || '';
  if (!accountSid || !authToken || !fromNumber) throw new Error('Twilio env vars missing');
  const authHeader = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
  const body = new URLSearchParams({ To: toE164, From: fromNumber, Url: twimlUrl, Method: 'POST' });
  const resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`, {
    method: 'POST',
    headers: { Authorization: `Basic ${authHeader}`, 'Content-Type': 'application/x-www-form-urlencoded' },
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



