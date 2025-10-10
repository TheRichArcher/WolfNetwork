// Lightweight Airtable-backed data access for demo; replace with Postgres/Prisma in production.
import Airtable, { type FieldSet } from 'airtable';
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
  // Direct-call fields (optional)
  callSid?: string;
  activatedAt?: string;
  statusReason?: string;
  twilioStatus?: string;
  durationSeconds?: number;
};

const USERS_TABLE = process.env.USERS_TABLE_NAME || 'users';
const INCIDENTS_TABLE = process.env.INCIDENTS_TABLE_NAME || 'incidents';

function getBase() {
  const env = getEnv();
  if (!env.AIRTABLE_API_KEY || !env.AIRTABLE_BASE_ID) throw new Error('Airtable env missing');
  const base = new Airtable({ apiKey: env.AIRTABLE_API_KEY }).base(env.AIRTABLE_BASE_ID);
  return base;
}

function getField<T = unknown>(r: Airtable.Record<FieldSet>, candidates: string[], fallback?: T): T | undefined {
  for (const key of candidates) {
    const v = r.get(key);
    if (v !== undefined && v !== null && String(v).length > 0) return v as T;
  }
  return fallback;
}

export async function findUserBySessionEmail(email: string): Promise<UserRecord | null> {
  // For demo: map user by email to a Users table
  const base = getBase();
  const table = base(USERS_TABLE);
  const records = await table
    .select({ filterByFormula: `OR({email} = '${email}', {Email} = '${email}')`, maxRecords: 1 })
    .firstPage();
  if (records.length === 0) return null;
  const r = records[0];
  return {
    id: (getField<string>(r, ['id', 'ID']) as string) || r.id,
    wolfId: (getField<string>(r, ['wolfId', 'Invite Code', 'inviteCode']) as string) || '',
    phoneEncrypted: (getField<string>(r, ['phoneEncrypted', 'Phone Encrypted', 'phoneencrypted']) as string) || '',
    tier: (getField<UserRecord['tier']>(r, ['tier', 'Tier']) as UserRecord['tier']) || 'Silver',
    region: (getField<string>(r, ['region', 'Region']) as string) || 'LA',
    createdAt: (getField<string>(r, ['createdAt', 'CreatedAt', 'Created At']) as string) || new Date().toISOString(),
  };
}

export async function createIncident(incident: IncidentRecord): Promise<IncidentRecord> {
  const base = getBase();
  const table = base(INCIDENTS_TABLE);
  const created = await table.create([
    {
      fields: {
        // Write to common variants to increase compatibility with existing bases
        id: incident.id,
        ID: incident.id,
        wolfId: incident.wolfId,
        'Invite Code': incident.wolfId,
        sessionSid: incident.sessionSid,
        status: incident.status,
        Status: incident.status,
        type: incident.type || 'unknown',
        partnerId: incident.partnerId || '',
        operatorId: incident.operatorId || '',
        createdAt: incident.createdAt,
        CreatedAt: incident.createdAt,
        resolvedAt: incident.resolvedAt || '',
        ResolvedAt: incident.resolvedAt || '',
        tier: incident.tier || '',
        Tier: incident.tier || '',
        region: incident.region || '',
        Region: incident.region || '',
      },
    },
  ]);
  const r = created[0];
  return {
    id: (getField<string>(r, ['id', 'ID']) as string) || incident.id,
    wolfId: (getField<string>(r, ['wolfId', 'Invite Code']) as string) || incident.wolfId,
    sessionSid: (getField<string>(r, ['sessionSid', 'SessionSid']) as string) || '',
    status: (getField<IncidentRecord['status']>(r, ['status', 'Status']) as IncidentRecord['status']) || 'initiated',
    type: (getField<IncidentRecord['type']>(r, ['type', 'Type']) as IncidentRecord['type']) || 'unknown',
    partnerId: (getField<string>(r, ['partnerId', 'PartnerId']) as string) || undefined,
    operatorId: (getField<string>(r, ['operatorId', 'OperatorId']) as string) || undefined,
    createdAt: (getField<string>(r, ['createdAt', 'CreatedAt']) as string) || incident.createdAt,
    resolvedAt: (getField<string>(r, ['resolvedAt', 'ResolvedAt']) as string) || undefined,
    tier: (getField<IncidentRecord['tier']>(r, ['tier', 'Tier']) as IncidentRecord['tier']) || undefined,
    region: (getField<IncidentRecord['region']>(r, ['region', 'Region']) as IncidentRecord['region']) || undefined,
  };
}

export async function updateIncident(id: string, fields: Partial<IncidentRecord>): Promise<void> {
  const base = getBase();
  const table = base(INCIDENTS_TABLE);
  // Airtable typings are lax; project only known fields to avoid any
  const projected: Record<string, unknown> = {};
  if (typeof fields.status === 'string') { projected.status = fields.status; projected.Status = fields.status; }
  if (typeof fields.resolvedAt === 'string') { projected.resolvedAt = fields.resolvedAt; projected.ResolvedAt = fields.resolvedAt; }
  if (typeof fields.partnerId === 'string') projected.partnerId = fields.partnerId;
  if (typeof fields.operatorId === 'string') projected.operatorId = fields.operatorId;
  if (typeof fields.sessionSid === 'string') { projected.sessionSid = fields.sessionSid; projected.SessionSid = fields.sessionSid; }
  if (typeof fields.callSid === 'string') { projected.callSid = fields.callSid; projected.CallSid = fields.callSid; }
  if (typeof fields.activatedAt === 'string') { projected.activatedAt = fields.activatedAt; projected.ActivatedAt = fields.activatedAt; }
  if (typeof fields.statusReason === 'string') projected.statusReason = fields.statusReason;
  if (typeof fields.twilioStatus === 'string') projected.twilioStatus = fields.twilioStatus;
  if (typeof fields.durationSeconds === 'number') projected.durationSeconds = fields.durationSeconds;
  // Resolve whether the provided id is an Airtable Record ID (rec...) or our custom UUID in the {id} field
  let recordId = id;
  if (!/^rec[a-zA-Z0-9]{14}$/i.test(id)) {
    const matches = await table
      .select({ filterByFormula: `OR({id} = '${id}', {ID} = '${id}')`, maxRecords: 1 })
      .firstPage();
    if (matches.length === 0) throw new Error(`Incident not found for custom id ${id}`);
    recordId = matches[0].id;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await table.update([{ id: recordId, fields: projected } as unknown as any]);
}

export async function findIncidentByCallSid(callSid: string): Promise<IncidentRecord | null> {
  const base = getBase();
  const table = base('incidents');
  const records = await table
    .select({ filterByFormula: `{callSid} = '${callSid}'`, maxRecords: 1 })
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
    createdAt: (r.get('createdAt') as string) || '',
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

export async function findIncidentById(customIdOrRecId: string): Promise<IncidentRecord | null> {
  const base = getBase();
  const table = base('incidents');
  let record = null;
  if (/^rec[a-zA-Z0-9]{14}$/i.test(customIdOrRecId)) {
    record = await table.find(customIdOrRecId).catch(() => null);
  } else {
    const records = await table
      .select({ filterByFormula: `{id} = '${customIdOrRecId}'`, maxRecords: 1 })
      .firstPage();
    record = records[0] || null;
  }
  if (!record) return null;
  const r = record;
  return {
    id: (r.get('id') as string) || '',
    wolfId: (r.get('wolfId') as string) || '',
    sessionSid: (r.get('sessionSid') as string) || '',
    status: (r.get('status') as IncidentRecord['status']) || 'initiated',
    type: (r.get('type') as IncidentRecord['type']) || 'unknown',
    partnerId: (r.get('partnerId') as string) || undefined,
    operatorId: (r.get('operatorId') as string) || undefined,
    createdAt: (r.get('createdAt') as string) || '',
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

export async function findLastResolvedIncidentForWolfId(wolfId: string): Promise<IncidentRecord | null> {
  const base = getBase();
  const table = base(INCIDENTS_TABLE);
  const records = await table
    .select({
      filterByFormula: `AND(OR({wolfId} = '${wolfId}', {Invite Code} = '${wolfId}'), OR({status} = 'resolved', {Status} = 'resolved'))`,
      sort: [{ field: 'resolvedAt', direction: 'desc' }],
      maxRecords: 1,
    })
    .firstPage();
  if (records.length === 0) return null;
  const r = records[0];
  return {
    id: (getField<string>(r, ['id', 'ID']) as string) || '',
    wolfId: (getField<string>(r, ['wolfId', 'Invite Code']) as string) || '',
    sessionSid: (getField<string>(r, ['sessionSid', 'SessionSid']) as string) || '',
    status: (getField<IncidentRecord['status']>(r, ['status', 'Status']) as IncidentRecord['status']) || 'resolved',
    type: (getField<IncidentRecord['type']>(r, ['type', 'Type']) as IncidentRecord['type']) || 'unknown',
    partnerId: (getField<string>(r, ['partnerId', 'PartnerId']) as string) || undefined,
    operatorId: (getField<string>(r, ['operatorId', 'OperatorId']) as string) || undefined,
    createdAt: (getField<string>(r, ['createdAt', 'CreatedAt']) as string) || '',
    resolvedAt: (getField<string>(r, ['resolvedAt', 'ResolvedAt']) as string) || undefined,
    tier: (getField<IncidentRecord['tier']>(r, ['tier', 'Tier']) as IncidentRecord['tier']) || undefined,
    region: (getField<IncidentRecord['region']>(r, ['region', 'Region']) as IncidentRecord['region']) || undefined,
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


