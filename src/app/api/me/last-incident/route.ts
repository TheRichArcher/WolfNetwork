import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { findLastResolvedIncidentForWolfId, findUserBySessionEmail } from '@/lib/db';

export async function GET(req: NextRequest) {
  const token = await getToken({ req });
  const email = typeof token?.email === 'string' ? token.email : undefined;
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = await findUserBySessionEmail(email);
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const incident = await findLastResolvedIncidentForWolfId(user.wolfId);
  if (!incident) return NextResponse.json({});
  return NextResponse.json({
    id: incident.id,
    createdAt: incident.createdAt,
    resolvedAt: incident.resolvedAt || null,
    operatorId: incident.operatorId || null,
  });
}


