import Airtable from 'airtable';
import { getEnv } from './env';
import { logEvent } from './log';

function extractStatusCode(err: unknown): number | undefined {
  const maybe = (err as { statusCode?: unknown })?.statusCode;
  return typeof maybe === 'number' ? maybe : undefined;
}
import { findUserBySessionEmail, type IncidentRecord } from './db';

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
        filterByFormula: `AND(OR({wolfId} = '${user.wolfId}', {Invite Code} = '${user.wolfId}'), OR({status} = 'initiated', {status} = 'active', {Status} = 'initiated', {Status} = 'active'))`,
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
      filterByFormula: `AND(OR({wolfId} = '${wolfId}', {Invite Code} = '${wolfId}'), OR({status} = 'initiated', {status} = 'active', {Status} = 'initiated', {Status} = 'active'))`,
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



