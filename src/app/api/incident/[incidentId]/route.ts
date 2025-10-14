import { NextRequest, NextResponse } from 'next/server';
import { findIncidentById } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, ctx: { params: { incidentId?: string } }) {
  try {
    const incidentId = String(ctx?.params?.incidentId || '').trim();
    if (!incidentId) return NextResponse.json({ error: 'Missing incidentId' }, { status: 400 });
    const incident = await findIncidentById(incidentId);
    if (!incident) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    // Return minimal fields for status display; avoid exposing PII
    return NextResponse.json({
      id: incident.id,
      wolfId: incident.wolfId,
      status: incident.status,
      twilioStatus: incident.twilioStatus,
      createdAt: incident.createdAt,
      resolvedAt: incident.resolvedAt || null,
      durationSeconds: incident.durationSeconds,
      callSid: incident.callSid,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}


