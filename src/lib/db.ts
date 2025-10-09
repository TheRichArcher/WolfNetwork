// Lightweight Airtable-backed data access for demo; replace with Postgres/Prisma in production.
import Airtable from 'airtable';
import { getEnv } from './env';

export type UserRecord = {
  id: string; // UUID
  wolfId: string;
  phoneEncrypted: string; // AES-encrypted E.164
  tier: 'Silver' | 'Gold' | 'Platinum';
  region: string;
  createdAt: string;
};

export type IncidentRecord = {
  id: string; // UUID
  wolfId: string;
  sessionSid: string;
  status: 'initiated' | 'active' | 'resolved';
  type?: 'legal' | 'medical' | 'pr' | 'security' | 'unknown';
  partnerId?: string;
  operatorId?: string;
  createdAt: string;
  resolvedAt?: string;
  tier?: 'Silver' | 'Gold' | 'Platinum';
  region?: string;
};

function getBase() {
  const env = getEnv();
  if (!env.AIRTABLE_API_KEY || !env.AIRTABLE_BASE_ID) throw new Error('Airtable env missing');
  const base = new Airtable({ apiKey: env.AIRTABLE_API_KEY }).base(env.AIRTABLE_BASE_ID);
  return base;
}

export async function findUserBySessionEmail(email: string): Promise<UserRecord | null> {
  // For demo: map user by email to a Users table
  const base = getBase();
  const table = base('users');
  const records = await table.select({ filterByFormula: `{email} = '${email}'`, maxRecords: 1 }).firstPage();
  if (records.length === 0) return null;
  const r = records[0];
  return {
    id: r.get('id') as string,
    wolfId: (r.get('wolfId') as string) || '',
    phoneEncrypted: (r.get('phoneEncrypted') as string) || '',
    tier: (r.get('tier') as UserRecord['tier']) || 'Silver',
    region: (r.get('region') as string) || 'LA',
    createdAt: (r.get('createdAt') as string) || new Date().toISOString(),
  };
}

export async function createIncident(incident: IncidentRecord): Promise<IncidentRecord> {
  const base = getBase();
  const table = base('incidents');
  const created = await table.create([
    {
      fields: {
        id: incident.id,
        wolfId: incident.wolfId,
        sessionSid: incident.sessionSid,
        status: incident.status,
        type: incident.type || 'unknown',
        partnerId: incident.partnerId || '',
        operatorId: incident.operatorId || '',
        createdAt: incident.createdAt,
        resolvedAt: incident.resolvedAt || '',
        tier: incident.tier || '',
        region: incident.region || '',
      },
    },
  ]);
  const r = created[0];
  return {
    id: r.get('id') as string,
    wolfId: r.get('wolfId') as string,
    sessionSid: (r.get('sessionSid') as string) || '',
    status: (r.get('status') as IncidentRecord['status']) || 'initiated',
    type: (r.get('type') as IncidentRecord['type']) || 'unknown',
    partnerId: (r.get('partnerId') as string) || undefined,
    operatorId: (r.get('operatorId') as string) || undefined,
    createdAt: (r.get('createdAt') as string) || incident.createdAt,
    resolvedAt: (r.get('resolvedAt') as string) || undefined,
    tier: (r.get('tier') as IncidentRecord['tier']) || undefined,
    region: (r.get('region') as string) || undefined,
  };
}

export async function updateIncident(id: string, fields: Partial<IncidentRecord>): Promise<void> {
  const base = getBase();
  const table = base('incidents');
  // Airtable typings are lax; project only known fields to avoid any
  const projected: Record<string, string> = {};
  if (typeof fields.status === 'string') projected.status = fields.status;
  if (typeof fields.resolvedAt === 'string') projected.resolvedAt = fields.resolvedAt;
  if (typeof fields.partnerId === 'string') projected.partnerId = fields.partnerId;
  if (typeof fields.operatorId === 'string') projected.operatorId = fields.operatorId;
  // Resolve whether the provided id is an Airtable Record ID (rec...) or our custom UUID in the {id} field
  let recordId = id;
  if (!/^rec[a-zA-Z0-9]{14}$/i.test(id)) {
    const matches = await table
      .select({ filterByFormula: `{id} = '${id}'`, maxRecords: 1 })
      .firstPage();
    if (matches.length === 0) throw new Error(`Incident not found for custom id ${id}`);
    recordId = matches[0].id;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await table.update([{ id: recordId, fields: projected } as unknown as any]);
}

export async function findLastResolvedIncidentForWolfId(wolfId: string): Promise<IncidentRecord | null> {
  const base = getBase();
  const table = base('incidents');
  const records = await table
    .select({
      filterByFormula: `AND({wolfId} = '${wolfId}', {status} = 'resolved')`,
      sort: [{ field: 'resolvedAt', direction: 'desc' }],
      maxRecords: 1,
    })
    .firstPage();
  if (records.length === 0) return null;
  const r = records[0];
  return {
    id: r.get('id') as string,
    wolfId: (r.get('wolfId') as string) || '',
    sessionSid: (r.get('sessionSid') as string) || '',
    status: (r.get('status') as IncidentRecord['status']) || 'resolved',
    type: (r.get('type') as IncidentRecord['type']) || 'unknown',
    partnerId: (r.get('partnerId') as string) || undefined,
    operatorId: (r.get('operatorId') as string) || undefined,
    createdAt: (r.get('createdAt') as string) || '',
    resolvedAt: (r.get('resolvedAt') as string) || undefined,
    tier: (r.get('tier') as IncidentRecord['tier']) || undefined,
    region: (r.get('region') as IncidentRecord['region']) || undefined,
  };
}


// Security flags (server-derived readiness). These fields are optional in Airtable users table.
export async function getUserSecurityFlagsByEmail(email: string): Promise<{ twoFA: boolean; profileVerified: boolean; hasPin: boolean }> {
  const base = getBase();
  const table = base('users');
  const records = await table.select({ filterByFormula: `{email} = '${email}'`, maxRecords: 1 }).firstPage();
  if (records.length === 0) {
    return { twoFA: false, profileVerified: false, hasPin: false };
  }
  const r = records[0];
  const val = (k: string) => {
    const v = r.get(k);
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v !== 0;
    if (typeof v === 'string') return v.trim() === '1' || /true|yes|y/i.test(v);
    return false;
  };
  return {
    twoFA: val('has2FA') || val('twoFA') || false,
    profileVerified: val('profileVerified') || false,
    hasPin: val('securePIN') || val('hasPin') || false,
  };
}


