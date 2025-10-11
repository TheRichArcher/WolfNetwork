import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { findUserBySessionEmail } from '@/lib/db';

export const runtime = 'nodejs';

type TeamMember = { category: 'Legal' | 'Medical' | 'PR' | 'Security'; name: string; status: 'Active' | 'Rotating' | 'Offline' };

function buildMockTeam(region: string): TeamMember[] {
  // Simple region-based names for demo; replace with real roster source later
  const regionPrefix = region?.toUpperCase?.().slice(0, 3) || 'LA';
  return [
    { category: 'Legal', name: `${regionPrefix} Legal Ava`, status: 'Active' },
    { category: 'Medical', name: `${regionPrefix} Dr. Keene`, status: 'Active' },
    { category: 'PR', name: `${regionPrefix} Maxwell Group`, status: 'Rotating' },
    { category: 'Security', name: `${regionPrefix} Shadowline`, status: 'Active' },
  ];
}

export async function GET(req: NextRequest) {
  const token = await getToken({ req });
  const email = typeof token?.email === 'string' ? token.email : undefined;
  if (!email) return NextResponse.json({ team: [] });
  const user = await findUserBySessionEmail(email);
  if (!user) return NextResponse.json({ team: [] });
  const team = buildMockTeam(user.region || 'LA');
  // Only expose first names or firm aliases
  const redacted = team.map((t) => ({
    category: t.category,
    name: t.name.replace(/^(Dr\.\s+)?(\w+)(.*)$/i, (_m, dr, first, rest) => `${dr || ''}${first}${rest ? '' : ''}`),
    status: t.status,
  }));
  return NextResponse.json({ team: redacted });
}


