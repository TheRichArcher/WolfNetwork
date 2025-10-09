import { createHmac, timingSafeEqual } from 'crypto';
import { getEnv } from './env';

function buildSignaturePayload(url: string, params: URLSearchParams | null): string {
  if (!params) return url;
  const entries = Array.from(params.entries()).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  let s = url;
  for (const [k, v] of entries) s += k + v;
  return s;
}

export function verifyTwilioSignature(opts: {
  fullUrl: string;
  xSignature: string | null;
  formParams?: URLSearchParams | null;
}): boolean {
  const token = getEnv().TWILIO_AUTH_TOKEN || '';
  if (!token || !opts.xSignature) return false;
  const payload = buildSignaturePayload(opts.fullUrl, opts.formParams || null);
  const hmac = createHmac('sha1', token);
  hmac.update(payload);
  const expected = Buffer.from(hmac.digest('base64'));
  const provided = Buffer.from(opts.xSignature);
  if (expected.length !== provided.length) return false;
  return timingSafeEqual(expected, provided);
}


