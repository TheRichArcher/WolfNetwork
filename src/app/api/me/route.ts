import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { findUserBySessionEmail, upsertUserBasic } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const token = await getToken({ req });
  const email = typeof token?.email === 'string' ? token.email.toLowerCase() : undefined;

  // Bypass to enable testing without auth when explicitly enabled
  if (!email && process.env.AUTH_DEV_BYPASS === 'true') {
    return NextResponse.json({ wolfId: 'WOLF-DEV-1234', tier: 'Gold', region: 'LA' });
  }

  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let user = await findUserBySessionEmail(email);
  if (!user) {
    const wolfId = `WOLF-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    await upsertUserBasic({ email, wolfId, status: 'active', tier: 'Silver' });
    user = await findUserBySessionEmail(email);
  }
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ wolfId: user.wolfId, tier: user.tier, region: user.region });
}


