// Lightweight Airtable-backed data access for demo; replace with Postgres/Prisma in production.
import Airtable, { type FieldSet } from 'airtable';
import { getEnv } from './env';
import { logEvent } from './log';

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
const USERS_TABLE_ALT = USERS_TABLE === 'users' ? 'Users' : USERS_TABLE === 'Users' ? 'users' : undefined;
const INCIDENTS_TABLE = process.env.INCIDENTS_TABLE_NAME || 'incidents';

function getBase() {
  const env = getEnv();
  if (!env.AIRTABLE_API_KEY || !env.AIRTABLE_BASE_ID) throw new Error('Airtable env missing');
  const base = new Airtable({ apiKey: env.AIRTABLE_API_KEY }).base(env.AIRTABLE_BASE_ID);
  return base;
}

function extractStatusCode(err: unknown): number | undefined {
  const maybe = (err as { statusCode?: unknown })?.statusCode;
  return typeof maybe === 'number' ? maybe : undefined;
}

function getField<T = unknown>(r: Airtable.Record<FieldSet>, candidates: string[], fallback?: T): T | undefined {
  for (const key of candidates) {
    const v = r.get(key);
    if (v !== undefined && v !== null && String(v).length > 0) return v as T;
  }
  return fallback;
}

export async function findUserBySessionEmail(email: string): Promise<UserRecord | null> {
  try {
    // For demo: map user by email to a Users table
    const base = getBase();
    const table = base(USERS_TABLE);
    const records = await table
      .select({ filterByFormula: `{email} = '${email}'`, maxRecords: 1 })
      .firstPage();
    if (records.length === 0) return null;
    const r = records[0];
    return {
      id: (r.get('id') as string) || r.id,
      wolfId: (r.get('wolfId') as string) || '',
      phoneEncrypted: (r.get('phoneEncrypted') as string) || '',
      tier: (r.get('tier') as UserRecord['tier']) || 'Silver',
      region: (r.get('region') as string) || 'LA',
      createdAt: (r.get('createdAt') as string) || new Date().toISOString(),
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const statusCode = extractStatusCode(e);
    logEvent({ event: 'airtable_error', op: 'select', table: USERS_TABLE, statusCode, error: msg });
    throw e;
  }
}

// Upsert or create a basic user record for waitlist/invite tracking.
export async function upsertUserBasic(params: {
  email?: string;
  phoneEncrypted?: string;
  status?: 'pending' | 'approved' | 'active';
  source?: string; // e.g., waitlist, comped_code:XYZ
  wolfId?: string;
  tier?: UserRecord['tier'];
}): Promise<{ id: string } | null> {
  const attempt = async (tableName: string): Promise<{ id: string } | null> => {
    const base = getBase();
    const table = base(tableName);
    const email = (params.email || '').trim().toLowerCase();
    const results = email
      ? await table
          .select({ filterByFormula: `{email} = '${email}'`, maxRecords: 1 })
          .firstPage()
      : [];
    const fields: FieldSet = {};
    if (email) {
      fields.email = email;
    }
    if (typeof params.phoneEncrypted === 'string') {
      fields.phoneEncrypted = params.phoneEncrypted;
    }
    if (typeof params.status === 'string') {
      fields.status = params.status;
    }
    if (typeof params.source === 'string') {
      fields.source = params.source;
    }
    if (typeof params.wolfId === 'string') {
      fields.wolfId = params.wolfId;
    }
    if (typeof params.tier === 'string') {
      fields.tier = params.tier;
    }

    if (results.length > 0) {
      const rec = results[0];
      await table.update([{ id: rec.id, fields }]);
      return { id: rec.id };
    }
    const created = await table.create([{ fields }]);
    return { id: created[0].id };
  };

  try {
    return await attempt(USERS_TABLE);
  } catch (e: unknown) {
    const statusCode = extractStatusCode(e);
    const msg = e instanceof Error ? e.message : String(e);
    // Retry with alternate table casing if table not found
    if ((statusCode === 404 || /table/i.test(msg)) && USERS_TABLE_ALT) {
      try {
        const res = await attempt(USERS_TABLE_ALT);
        logEvent({ event: 'airtable_table_fallback', op: 'upsert_user_basic', table: USERS_TABLE_ALT });
        return res;
      } catch (e2: unknown) {
        const msg2 = e2 instanceof Error ? e2.message : String(e2);
        logEvent({ event: 'airtable_error', op: 'upsert_user_basic', table: USERS_TABLE_ALT, error: msg2 });
        throw e2;
      }
    }
    logEvent({ event: 'airtable_error', op: 'upsert_user_basic', table: USERS_TABLE, error: msg });
    throw e;
  }
}

// Validate a comped code against an Airtable table ('codes' by default) and return metadata
export async function validateCompedCode(code: string): Promise<{ valid: boolean; wolfId?: string; tier?: UserRecord['tier'] }>{
  const TABLE = process.env.CODES_TABLE_NAME || 'codes';
  try {
    const base = getBase();
    const table = base(TABLE);
    const value = code.trim();
    if (!value) return { valid: false };
    const records = await table
      .select({ filterByFormula: `{code} = '${value}'`, maxRecords: 1 })
      .firstPage();
    if (records.length === 0) return { valid: false };
    const r = records[0];
    const disabled = !!getField<boolean>(r, ['disabled', 'Disabled'], false);
    if (disabled) return { valid: false };
    const wolfId = getField<string>(r, ['wolfId', 'WolfId', 'Invite Code']);
    const tier = getField<UserRecord['tier']>(r, ['tier', 'Tier']);
    return { valid: true, wolfId, tier };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logEvent({ event: 'airtable_error', op: 'validate_comped_code', table: process.env.CODES_TABLE_NAME || 'codes', error: msg });
    throw e;
  }
}

export async function createIncident(incident: IncidentRecord): Promise<IncidentRecord> {
  try {
    const base = getBase();
    const table = base(INCIDENTS_TABLE);
    const created = await table.create([
      {
        fields: {
          // Only write lowercase camelCase field names per current schema
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
      id: (r.get('id') as string) || incident.id,
      wolfId: (r.get('wolfId') as string) || incident.wolfId,
      sessionSid: (r.get('sessionSid') as string) || '',
      status: (r.get('status') as IncidentRecord['status']) || 'initiated',
      type: (r.get('type') as IncidentRecord['type']) || 'unknown',
      partnerId: (r.get('partnerId') as string) || undefined,
      operatorId: (r.get('operatorId') as string) || undefined,
      createdAt: (r.get('createdAt') as string) || incident.createdAt,
      resolvedAt: (r.get('resolvedAt') as string) || undefined,
      tier: (r.get('tier') as IncidentRecord['tier']) || undefined,
      region: (r.get('region') as IncidentRecord['region']) || undefined,
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const statusCode = extractStatusCode(e);
    logEvent({ event: 'airtable_error', op: 'create', table: INCIDENTS_TABLE, statusCode, error: msg });
    throw e;
  }
}

export async function updateIncident(id: string, fields: Partial<IncidentRecord>): Promise<void> {
  try {
    const base = getBase();
    const table = base(INCIDENTS_TABLE);
    // Airtable typings are lax; project only known fields to avoid any
    const projected: FieldSet = {};
    if (typeof fields.status === 'string') { projected.status = fields.status; }
    if (typeof fields.resolvedAt === 'string') { projected.resolvedAt = fields.resolvedAt; }
    if (typeof fields.partnerId === 'string') projected.partnerId = fields.partnerId;
    if (typeof fields.operatorId === 'string') projected.operatorId = fields.operatorId;
    if (typeof fields.sessionSid === 'string') { projected.sessionSid = fields.sessionSid; }
    if (typeof fields.callSid === 'string') { projected.callSid = fields.callSid; }
    if (typeof fields.activatedAt === 'string') { projected.activatedAt = fields.activatedAt; }
    if (typeof fields.statusReason === 'string') projected.statusReason = fields.statusReason;
    if (typeof fields.twilioStatus === 'string') projected.twilioStatus = fields.twilioStatus;
    if (typeof fields.durationSeconds === 'number') projected.durationSeconds = fields.durationSeconds;
    // Resolve whether the provided id is an Airtable Record ID (rec...) or our custom UUID in the {id} field
    let recordId = id;
    if (!/^rec[a-zA-Z0-9]{14}$/i.test(id)) {
      const matches = await table
        .select({ filterByFormula: `{id} = '${id}'`, maxRecords: 1 })
        .firstPage();
      if (matches.length === 0) throw new Error(`Incident not found for custom id ${id}`);
      recordId = matches[0].id;
    }
    await table.update([{ id: recordId, fields: projected }]);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const statusCode = extractStatusCode(e);
    logEvent({ event: 'airtable_error', op: 'update', table: INCIDENTS_TABLE, statusCode, error: msg });
    throw e;
  }
}

export async function findIncidentByCallSid(callSid: string): Promise<IncidentRecord | null> {
  try {
    const base = getBase();
    const table = base('incidents');
    const records = await table
      .select({ filterByFormula: `{callSid} = '${callSid}'`, maxRecords: 1 })
      .firstPage();
    if (records.length === 0) return null;
    const r = records[0];
    return {
    id: (getField<string>(r, ['id', 'ID']) as string) || '',
    wolfId: (getField<string>(r, ['wolfId', 'Invite Code']) as string) || '',
    sessionSid: (getField<string>(r, ['sessionSid', 'SessionSid']) as string) || '',
    status: (getField<IncidentRecord['status']>(r, ['status', 'Status']) as IncidentRecord['status']) || 'initiated',
    type: (getField<IncidentRecord['type']>(r, ['type', 'Type']) as IncidentRecord['type']) || 'unknown',
    partnerId: (getField<string>(r, ['partnerId', 'PartnerId']) as string) || undefined,
    operatorId: (getField<string>(r, ['operatorId', 'OperatorId']) as string) || undefined,
    createdAt: (getField<string>(r, ['createdAt', 'CreatedAt']) as string) || '',
    resolvedAt: (getField<string>(r, ['resolvedAt', 'ResolvedAt']) as string) || undefined,
    tier: (getField<IncidentRecord['tier']>(r, ['tier', 'Tier']) as IncidentRecord['tier']) || undefined,
    region: (getField<IncidentRecord['region']>(r, ['region', 'Region']) as IncidentRecord['region']) || undefined,
    callSid: (getField<string>(r, ['callSid', 'CallSid']) as string) || undefined,
    activatedAt: (getField<string>(r, ['activatedAt', 'ActivatedAt']) as string) || undefined,
    statusReason: (getField<string>(r, ['statusReason', 'StatusReason']) as string) || undefined,
    twilioStatus: (getField<string>(r, ['twilioStatus', 'TwilioStatus']) as string) || undefined,
    durationSeconds: (getField<number>(r, ['durationSeconds', 'DurationSeconds']) as number) || undefined,
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const statusCode = extractStatusCode(e);
    logEvent({ event: 'airtable_error', op: 'select', table: 'incidents', statusCode, error: msg });
    throw e;
  }
}

export async function findIncidentById(customIdOrRecId: string): Promise<IncidentRecord | null> {
  try {
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
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const statusCode = extractStatusCode(e);
    logEvent({ event: 'airtable_error', op: 'find', table: 'incidents', statusCode, error: msg });
    throw e;
  }
}

export async function findLastResolvedIncidentForWolfId(wolfId: string): Promise<IncidentRecord | null> {
  try {
    const base = getBase();
    const table = base(INCIDENTS_TABLE);
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
      callSid: (getField<string>(r, ['callSid', 'CallSid']) as string) || undefined,
      activatedAt: (getField<string>(r, ['activatedAt', 'ActivatedAt']) as string) || undefined,
      statusReason: (getField<string>(r, ['statusReason', 'StatusReason']) as string) || undefined,
      twilioStatus: (getField<string>(r, ['twilioStatus', 'TwilioStatus']) as string) || undefined,
      durationSeconds: (getField<number>(r, ['durationSeconds', 'DurationSeconds']) as number) || undefined,
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const statusCode = extractStatusCode(e);
    logEvent({ event: 'airtable_error', op: 'select', table: INCIDENTS_TABLE, statusCode, error: msg });
    throw e;
  }
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


