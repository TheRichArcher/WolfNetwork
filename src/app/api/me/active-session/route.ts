import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { getActiveIncidentForEmail } from '@/lib/incidents';

export async function GET(req: NextRequest) {
  const token = await getToken({ req });
  const email = typeof token?.email === 'string' ? token.email : undefined;
  if (!email) return NextResponse.json({ active: false });

  const incident = await getActiveIncidentForEmail(email);
  if (!incident) return NextResponse.json({ active: false });

  const startedAt = incident.createdAt;
  const operator = incident.operatorId || 'Operator';
  return NextResponse.json({
    active: true,
    sessionSid: incident.sessionSid,
    incidentId: incident.id,
    operator,
    startedAt,
  });
}


