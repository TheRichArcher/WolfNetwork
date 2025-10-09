import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { getUserSecurityFlagsByEmail } from '@/lib/db';

export async function GET(req: NextRequest) {
  const token = await getToken({ req });
  const email = typeof token?.email === 'string' ? token.email : undefined;

  // Bypass to enable testing without auth when explicitly enabled
  if (!email && process.env.AUTH_DEV_BYPASS === 'true') {
    const percent = Math.round((2 / 3) * 100);
    return NextResponse.json({ twoFA: true, profileVerified: true, securePIN: false, percent });
  }

  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const flags = await getUserSecurityFlagsByEmail(email);
  const total = 3;
  const done = (flags.twoFA ? 1 : 0) + (flags.profileVerified ? 1 : 0) + (flags.hasPin ? 1 : 0);
  const percent = Math.round((done / total) * 100);

  return NextResponse.json({
    twoFA: flags.twoFA,
    profileVerified: flags.profileVerified,
    securePIN: flags.hasPin,
    percent,
  });
}


