import { NextRequest, NextResponse } from 'next/server';
import { getEnv } from '@/lib/env';

async function getManagementToken(domain: string, clientId: string, clientSecret: string, audience: string): Promise<string> {
  const res = await fetch(`https://${domain}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      audience,
    }),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('failed_token');
  const j = await res.json();
  return j.access_token as string;
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const email = (url.searchParams.get('email') || '').trim().toLowerCase();
    if (!email) return NextResponse.json({ error: 'email_required' }, { status: 400 });

    const env = getEnv();
    const domain = env.AUTH0_DOMAIN || '';
    const clientId = env.AUTH0_MGMT_CLIENT_ID || '';
    const clientSecret = env.AUTH0_MGMT_CLIENT_SECRET || '';
    const audience = env.AUTH0_MGMT_AUDIENCE || (domain ? `https://${domain}/api/v2/` : '');
    if (!domain || !clientId || !clientSecret || !audience) {
      return NextResponse.json({ error: 'mgmt_env_missing' }, { status: 500 });
    }

    const token = await getManagementToken(domain, clientId, clientSecret, audience);
    const res = await fetch(`https://${domain}/api/v2/users-by-email?email=${encodeURIComponent(email)}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return NextResponse.json({ error: 'lookup_failed' }, { status: 500 });
    const list = (await res.json()) as Array<{ user_id: string }>; // shape not strictly needed
    const exists = Array.isArray(list) && list.length > 0;
    return NextResponse.json({ exists });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'unknown';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
