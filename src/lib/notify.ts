import { getEnv } from './env';
import { logEvent } from './log';

type Presence = Array<{ category: 'Legal' | 'Medical' | 'PR' | 'Security'; name: string; status: 'Active' | 'Rotating' | 'Offline' }>;

export type IncidentSummary = {
  id: string;
  wolfId: string;
  tier?: string;
  region?: string;
};

function buildDiscordMessage(incident: IncidentSummary, presence?: Presence, viewUrl?: string): { content: string } {
  const lines: string[] = [];
  lines.push(`🚨 Hotline activated`);
  lines.push(`• Wolf ID: ${incident.wolfId}`);
  if (incident.tier) lines.push(`• Tier: ${incident.tier}`);
  if (incident.region) lines.push(`• Region: ${incident.region}`);
  if (presence && presence.length > 0) {
    const roleMap: Record<string, string> = { Legal: 'Counsel', Medical: 'Clinician', PR: 'Comms', Security: 'Field' };
    const roleLine = presence
      .map((p) => {
        const role = roleMap[p.category] || p.category;
        if (p.status === 'Active') return `${role}: ✅`;
        if (p.status === 'Rotating') return `${role}: 🔄`;
        return `${role}: ⛔️`;
      })
      .join(' · ');
    if (roleLine) lines.push(`• Team: ${roleLine}`);
  }
  if (viewUrl) lines.push(`• View Incident: ${viewUrl}`);
  return { content: lines.join('\n') };
}

export async function notifyDiscordOnIncident(params: {
  incident: IncidentSummary;
  presence?: Presence;
  baseUrl?: string;
}): Promise<void> {
  const env = getEnv();
  const webhook = (env.DISCORD_WEBHOOK_URL || '').trim();
  if (!webhook) {
    logEvent({ event: 'notify_skipped', reason: 'missing_webhook', channel: 'discord', incidentId: params.incident.id });
    return;
  }
  const viewUrl = params.baseUrl ? `${params.baseUrl}/status/${encodeURIComponent(params.incident.id)}` : undefined;
  const body = buildDiscordMessage(params.incident, params.presence, viewUrl);
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


