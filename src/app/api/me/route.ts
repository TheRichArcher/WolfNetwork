import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { findUserBySessionEmail } from '@/lib/db';

export async function GET(req: NextRequest) {
  const token = await getToken({ req });
  const email = typeof token?.email === 'string' ? token.email : undefined;

  // Dev bypass to enable testing without auth
  if (!email && process.env.AUTH_DEV_BYPASS === 'true' && process.env.NODE_ENV !== 'production') {
    return NextResponse.json({ wolfId: 'WOLF-DEV-1234', tier: 'Gold', region: 'LA' });
  }

  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = await findUserBySessionEmail(email);
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ wolfId: user.wolfId, tier: user.tier, region: user.region });
}


