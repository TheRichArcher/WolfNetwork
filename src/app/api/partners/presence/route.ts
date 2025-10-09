import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { findUserBySessionEmail } from '@/lib/db';

type PresenceStatus = 'Active' | 'Rotating' | 'Offline';

export async function GET(req: NextRequest) {
  const token = await getToken({ req });
  const email = typeof token?.email === 'string' ? token.email : undefined;

  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await findUserBySessionEmail(email);
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Live-mock presence: deterministically vary by region hash to simulate rotation
  const seed = Array.from((user.region || 'LA')).reduce((a, c) => a + c.charCodeAt(0), 0);
  const rotate = (n: number) => (seed + Math.floor(Date.now() / 60000)) % n; // changes every 60s

  const categories = [
    { category: 'Legal', name: 'Counsel' },
    { category: 'Medical', name: 'Clinician' },
    { category: 'PR', name: 'Comms' },
    { category: 'Security', name: 'Field Team' },
  ];

  const statuses: PresenceStatus[] = ['Active', 'Rotating', 'Offline'];
  const presence = categories.map((c, idx) => {
    const status = statuses[(rotate(3) + idx) % 3];
    return { category: c.category, name: c.name, status };
  });

  return NextResponse.json({ partners: presence });
}


