import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { findUserBySessionEmail } from '@/lib/db';

export async function GET(req: NextRequest) {
  const token = await getToken({ req });
  const email = (token as any)?.email as string | undefined;
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = await findUserBySessionEmail(email);
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ wolfId: user.wolfId, tier: user.tier, region: user.region });
}


