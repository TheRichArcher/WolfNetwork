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
  await table.update([{ id, fields: fields as any }]);
}


