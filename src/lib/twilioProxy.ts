// Minimal Twilio Proxy session helpers using REST API to avoid adding SDK dependency.
import { getEnv } from './env';

type CreateSessionResponse = { sid: string };

export async function createProxySession(params: {
  uniqueName: string;
  ttlHours?: number;
}): Promise<CreateSessionResponse> {
  const env = getEnv();
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PROXY_SERVICE_SID } = env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PROXY_SERVICE_SID) {
    throw new Error('Twilio Proxy env missing');
  }
  const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
  const body = new URLSearchParams();
  body.set('UniqueName', params.uniqueName);
  if (params.ttlHours) body.set('Ttl', String(params.ttlHours * 3600));
  const url = `https://proxy.twilio.com/v1/Services/${TWILIO_PROXY_SERVICE_SID}/Sessions`;
  const resp = await fetch(url, { method: 'POST', headers: { Authorization: `Basic ${auth}` }, body });
  if (!resp.ok) throw new Error(`Twilio Proxy create session failed: ${resp.status}`);
  return resp.json();
}

export async function addParticipant(params: {
  sessionSid: string;
  identifier: string; // E.164 number
  friendlyName: string;
}): Promise<{ sid: string }> {
  const env = getEnv();
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PROXY_SERVICE_SID } = env;
  const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
  const body = new URLSearchParams();
  body.set('Identifier', params.identifier);
  body.set('FriendlyName', params.friendlyName);
  const url = `https://proxy.twilio.com/v1/Services/${TWILIO_PROXY_SERVICE_SID}/Sessions/${params.sessionSid}/Participants`;
  const resp = await fetch(url, { method: 'POST', headers: { Authorization: `Basic ${auth}` }, body });
  if (!resp.ok) throw new Error(`Twilio Proxy add participant failed: ${resp.status}`);
  return resp.json();
}

export async function closeSession(sessionSid: string): Promise<void> {
  const env = getEnv();
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PROXY_SERVICE_SID } = env;
  const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
  const url = `https://proxy.twilio.com/v1/Services/${TWILIO_PROXY_SERVICE_SID}/Sessions/${sessionSid}`;
  const resp = await fetch(url, { method: 'DELETE', headers: { Authorization: `Basic ${auth}` } });
  if (!resp.ok) throw new Error(`Twilio Proxy close session failed: ${resp.status}`);
}


