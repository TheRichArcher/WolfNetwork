import { getEnv } from './env';
import { logEvent } from './log';

type Presence = Array<{ category: 'Legal' | 'Medical' | 'PR' | 'Security'; name: string; status: 'Active' | 'Rotating' | 'Offline' }>;

export type IncidentSummary = {
  id: string;
  wolfId: string;
  tier?: string;
  region?: string;
  callSid?: string;
};

const DEFAULT_WEBHOOK = 'https://discord.com/api/webhooks/1427704694200864800/A7bgIk2w2JQdhFYdLkMEU45xrH4AYLKjwk6DeEHEI7YGaR29VuMQWQew1Sfmh7G-sVDg';

function resolveBaseUrl(explicit?: string): string | undefined {
  const fromEnv = getEnv();
  const candidates = [
    explicit,
    fromEnv.PUBLIC_BASE_URL,
    process.env.RENDER_EXTERNAL_URL,
    process.env.NEXTAUTH_URL,
    process.env.SITE_URL,
    process.env.URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
  ].filter(Boolean) as string[];
  // Ensure we return an absolute https URL
  const first = candidates.find((u) => /^https?:\/\//i.test(u));
  return first;
}

function buildCreationEmbed(incident: IncidentSummary, presence?: Presence, viewUrl?: string) {
  const fields: Array<{ name: string; value: string; inline?: boolean }> = [];
  fields.push({ name: 'Wolf ID', value: incident.wolfId, inline: true });
  if (incident.region) fields.push({ name: 'Region', value: incident.region, inline: true });
  if (incident.tier) fields.push({ name: 'Tier', value: incident.tier, inline: true });
  if (incident.callSid) fields.push({ name: 'Call SID', value: incident.callSid, inline: false });
  if (presence && presence.length > 0) {
    const roleMap: Record<string, string> = { Legal: 'Counsel', Medical: 'Clinician', PR: 'Comms', Security: 'Field' };
    const team = presence
      .map((p) => {
        const role = roleMap[p.category] || p.category;
        if (p.status === 'Active') return `${role}: ✅`;
        if (p.status === 'Rotating') return `${role}: 🔄`;
        return `${role}: ⛔️`;
      })
      .join(' · ');
    if (team) fields.push({ name: 'Team', value: team, inline: false });
  }
  const description = viewUrl ? `[View Incident](${viewUrl})` : undefined;
  return {
    embeds: [
      {
        title: '🚨 Hotline Activated',
        description,
        color: 5793266, // Discord blurple-like tone for activation
        fields,
        footer: { text: `incidentId: ${incident.id}` },
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

export async function notifyDiscordOnIncident(params: {
  incident: IncidentSummary;
  presence?: Presence;
  baseUrl?: string;
}): Promise<void> {
  const env = getEnv();
  const webhook = (env.DISCORD_WEBHOOK_URL || DEFAULT_WEBHOOK).trim();
  const baseUrl = resolveBaseUrl(params.baseUrl);
  const viewUrl = baseUrl ? `${baseUrl}/status/${encodeURIComponent(params.incident.id)}` : undefined;
  const embed = buildCreationEmbed(params.incident, params.presence, viewUrl);
  const body = viewUrl ? { ...embed, content: viewUrl } : embed;
  try {
    const resp = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`Discord webhook failed (${resp.status}): ${text}`);
    }
    logEvent({ event: 'notify_sent', channel: 'discord', incidentId: params.incident.id });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logEvent({ event: 'notify_error', channel: 'discord', error: msg, incidentId: params.incident.id }, 'warn');
  }
}

type IncidentForResolution = {
  id: string;
  wolfId: string;
  tier?: string;
  region?: string;
  callSid?: string;
  status?: string;
  durationSeconds?: number;
};

function colorForStatus(status: string | undefined): number {
  switch ((status || '').toLowerCase()) {
    case 'resolved':
      return 3066993; // green
    case 'missed':
      return 15158332; // red
    case 'abandoned':
      return 9807270; // gray
    case 'pending_followup':
      return 15844367; // yellow
    default:
      return 5793266; // default
  }
}

export async function notifyDiscordOnIncidentResolved(params: {
  incident: IncidentForResolution;
  baseUrl?: string;
  followupNote?: string;
}): Promise<void> {
  const env = getEnv();
  const webhook = (env.DISCORD_WEBHOOK_URL || DEFAULT_WEBHOOK).trim();
  const baseUrl = resolveBaseUrl(params.baseUrl);
  if (!webhook) {
    logEvent({ event: 'notify_skipped', reason: 'missing_webhook', channel: 'discord', incidentId: params.incident.id });
    return;
  }
  const fields: Array<{ name: string; value: string; inline?: boolean }> = [
    { name: 'Wolf ID', value: params.incident.wolfId, inline: true },
  ];
  if (params.incident.region) fields.push({ name: 'Region', value: params.incident.region, inline: true });
  if (params.incident.tier) fields.push({ name: 'Tier', value: params.incident.tier, inline: true });
  if (params.incident.status) fields.push({ name: 'Status', value: params.incident.status, inline: true });
  if (typeof params.incident.durationSeconds === 'number') fields.push({ name: 'Duration', value: `${params.incident.durationSeconds}s`, inline: true });
  if (params.incident.callSid) fields.push({ name: 'Call SID', value: params.incident.callSid, inline: false });
  if ((params.incident.status || '').toLowerCase() === 'pending_followup' && params.followupNote) {
    fields.push({ name: 'Follow-up', value: params.followupNote, inline: false });
  }
  const viewUrl = baseUrl ? `${baseUrl}/status/${encodeURIComponent(params.incident.id)}` : undefined;
  const description = viewUrl ? `[View Incident](${viewUrl})` : undefined;
  const embed = {
    embeds: [
      {
        title: '✅ Incident Update',
        description,
        color: colorForStatus(params.incident.status),
        fields,
        footer: { text: `incidentId: ${params.incident.id}` },
        timestamp: new Date().toISOString(),
      },
    ],
  };
  const body = viewUrl ? { ...embed, content: viewUrl } : embed;
  try {
    const resp = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`Discord webhook failed (${resp.status}): ${text}`);
    }
    logEvent({ event: 'notify_sent', channel: 'discord', incidentId: params.incident.id });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logEvent({ event: 'notify_error', channel: 'discord', error: msg, incidentId: params.incident.id }, 'warn');
  }
}


