import Airtable from 'airtable';
import { getEnv } from './env';
import { logEvent } from './log';

function extractStatusCode(err: unknown): number | undefined {
  const maybe = (err as { statusCode?: unknown })?.statusCode;
  return typeof maybe === 'number' ? maybe : undefined;
}
import { findUserBySessionEmail, findIncidentById, updateIncident, type IncidentRecord } from './db';
import { notifyDiscordOnIncidentResolved } from './notify';

function getBase() {
  const env = getEnv();
  if (!env.AIRTABLE_API_KEY || !env.AIRTABLE_BASE_ID) throw new Error('Airtable env missing');
  const base = new Airtable({ apiKey: env.AIRTABLE_API_KEY }).base(env.AIRTABLE_BASE_ID);
  return base;
}

export async function getActiveIncidentForEmail(email: string): Promise<IncidentRecord | null> {
  try {
    const user = await findUserBySessionEmail(email);
    if (!user) return null;
    const base = getBase();
    const table = base('incidents');
    const records = await table
      .select({
        filterByFormula: `AND({wolfId} = '${user.wolfId}', OR({status} = 'initiated', {status} = 'active'))`,
        sort: [{ field: 'createdAt', direction: 'desc' }],
        maxRecords: 1,
      })
      .firstPage();
    if (records.length === 0) return null;
    const r = records[0];
    return {
      id: (r.get('id') as string) || '',
      wolfId: (r.get('wolfId') as string) || '',
      sessionSid: (r.get('sessionSid') as string) || '',
      status: (r.get('status') as IncidentRecord['status']) || 'initiated',
      type: (r.get('type') as IncidentRecord['type']) || 'unknown',
      partnerId: (r.get('partnerId') as string) || undefined,
      operatorId: (r.get('operatorId') as string) || undefined,
      createdAt: (r.get('createdAt') as string) || new Date().toISOString(),
      resolvedAt: (r.get('resolvedAt') as string) || undefined,
      tier: (r.get('tier') as IncidentRecord['tier']) || undefined,
      region: (r.get('region') as IncidentRecord['region']) || undefined,
      callSid: (r.get('callSid') as string) || undefined,
      activatedAt: (r.get('activatedAt') as string) || undefined,
      statusReason: (r.get('statusReason') as string) || undefined,
      twilioStatus: (r.get('twilioStatus') as string) || undefined,
      durationSeconds: (r.get('durationSeconds') as number) || undefined,
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const statusCode = extractStatusCode(e);
    logEvent({ event: 'airtable_error', op: 'select', table: 'incidents', statusCode, error: msg });
    throw e;
  }
}

export async function getActiveIncidentForWolfId(wolfId: string): Promise<IncidentRecord | null> {
  const base = getBase();
  const table = base('incidents');
  const records = await table
    .select({
      filterByFormula: `AND({wolfId} = '${wolfId}', OR({status} = 'initiated', {status} = 'active'))`,
      sort: [{ field: 'createdAt', direction: 'desc' }],
      maxRecords: 1,
    })
    .firstPage();
  if (records.length === 0) return null;
  const r = records[0];
  return {
    id: (r.get('id') as string) || '',
    wolfId: (r.get('wolfId') as string) || '',
    sessionSid: (r.get('sessionSid') as string) || '',
    status: (r.get('status') as IncidentRecord['status']) || 'initiated',
    type: (r.get('type') as IncidentRecord['type']) || 'unknown',
    partnerId: (r.get('partnerId') as string) || undefined,
    operatorId: (r.get('operatorId') as string) || undefined,
    createdAt: (r.get('createdAt') as string) || new Date().toISOString(),
    resolvedAt: (r.get('resolvedAt') as string) || undefined,
    tier: (r.get('tier') as IncidentRecord['tier']) || undefined,
    region: (r.get('region') as IncidentRecord['region']) || undefined,
    callSid: (r.get('callSid') as string) || undefined,
    activatedAt: (r.get('activatedAt') as string) || undefined,
    statusReason: (r.get('statusReason') as string) || undefined,
    twilioStatus: (r.get('twilioStatus') as string) || undefined,
    durationSeconds: (r.get('durationSeconds') as number) || undefined,
  };
}

export async function getPresenceForRegion(region: string): Promise<Array<{ category: 'Legal' | 'Medical' | 'PR' | 'Security'; name: string; status: 'Active' | 'Rotating' | 'Offline' }>> {
  // Mirror logic from /api/partners/presence to keep server-side availability without requiring auth
  // Deterministic rotation based on region and minute
  const seed = Array.from((region || 'LA')).reduce((a, c) => a + c.charCodeAt(0), 0);
  const rotate = (n: number) => (seed + Math.floor(Date.now() / 60000)) % n;
  const categories = [
    { category: 'Legal' as const, name: 'Counsel' },
    { category: 'Medical' as const, name: 'Clinician' },
    { category: 'PR' as const, name: 'Comms' },
    { category: 'Security' as const, name: 'Field Team' },
  ];
  const statuses = ['Active', 'Rotating', 'Offline'] as const;
  return categories.map((c, idx) => ({ category: c.category, name: c.name, status: statuses[(rotate(3) + idx) % 3] }));
}


// Centralized resolver for incident terminal states
export async function resolveIncident(params: {
  incidentId: string;
  status: 'resolved' | 'abandoned' | 'missed' | 'pending_followup';
  twilioStatus?: string;
  statusReason?: string;
  durationSeconds?: number;
}): Promise<{ skipped: boolean } | { ok: true } | { error: string }> {
  try {
    const incident = await findIncidentById(params.incidentId);
    if (!incident) return { error: 'not_found' };

    // Skip if already resolved
    if (incident.resolvedAt && incident.resolvedAt.length > 0) return { skipped: true } as const;

    const nowIso = new Date().toISOString();

    // Write lowercased Airtable fields
    const updates: Partial<IncidentRecord> = {
      status: params.status as IncidentRecord['status'],
      resolvedAt: nowIso,
    } as Partial<IncidentRecord>;

    if (typeof params.twilioStatus === 'string' && params.twilioStatus) {
      updates.twilioStatus = params.twilioStatus.toLowerCase();
    }
    if (typeof params.statusReason === 'string' && params.statusReason) {
      updates.statusReason = params.statusReason.toLowerCase();
    }
    if (typeof params.durationSeconds === 'number') {
      updates.durationSeconds = params.durationSeconds;
    }

    await updateIncident(incident.id, updates);
    // Fire-and-forget Discord resolution notification
    const env = getEnv();
    const baseUrl = env.PUBLIC_BASE_URL;
    notifyDiscordOnIncidentResolved({
      incident: {
        id: incident.id,
        wolfId: incident.wolfId,
        tier: incident.tier,
        region: incident.region,
        callSid: incident.callSid,
        status: params.status,
        durationSeconds: updates.durationSeconds,
      },
      baseUrl,
      followupNote: params.status === 'pending_followup' ? 'Operator to review and schedule follow-up' : undefined,
    }).catch(() => {});
    return { ok: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logEvent({ event: 'resolve_incident_error', error: msg });
    return { error: 'exception' };
  }
}



