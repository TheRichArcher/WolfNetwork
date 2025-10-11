import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { findLastResolvedIncidentForWolfId, findUserBySessionEmail } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const token = await getToken({ req });
  const email = typeof token?.email === 'string' ? token.email : undefined;
  if (!email) return NextResponse.json({});
  const user = await findUserBySessionEmail(email);
  if (!user) return NextResponse.json({});
  const incident = await findLastResolvedIncidentForWolfId(user.wolfId);
  if (!incident) return NextResponse.json({});
  return NextResponse.json({
    id: incident.id,
    createdAt: incident.createdAt,
    resolvedAt: incident.resolvedAt || null,
    operatorId: incident.operatorId || null,
  });
}


