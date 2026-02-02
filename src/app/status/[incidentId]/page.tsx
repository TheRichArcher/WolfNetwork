'use client';

import { useEffect, useState } from 'react';
import Layout from '@/components/Layout';

type Incident = {
  id: string;
  wolfId?: string;
  status?: string;
  type?: string;
  twilioStatus?: string;
  createdAt?: string;
  resolvedAt?: string | null;
  durationSeconds?: number;
};

const CRISIS_LABELS: Record<string, string> = {
  legal: '⚖️ Legal',
  medical: '🏥 Medical',
  security: '🛡️ Security',
  pr: '📢 PR',
  unknown: 'Unknown',
};

export default function IncidentStatusPage(props: unknown) {
  const incidentId: string = String((props as { params?: { incidentId?: string } })?.params?.incidentId || '');
  const [incident, setIncident] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;
    const load = async () => {
      try {
        const r = await fetch(`/api/incident/${encodeURIComponent(incidentId)}`);
        if (!r.ok) return;
        const j = await r.json();
        if (cancelled) return;
        if (j && j.id) {
          setIncident({
            id: j.id,
            wolfId: j.wolfId,
            status: j.status,
            type: j.type,
            twilioStatus: j.twilioStatus,
            createdAt: j.createdAt,
            resolvedAt: j.resolvedAt,
            durationSeconds: j.durationSeconds,
          });
        } else {
          setIncident((prev) => prev || { id: incidentId });
        }
        setLoading(false);
      } catch {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    timer = window.setInterval(load, 5000);
    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
    };
  }, [incidentId]);

  return (
    <Layout>
      <div className="p-4">
        <div className="bg-surface rounded-lg p-6 border border-border animate-fadeIn">
          <h1 className="text-2xl font-bold text-main-text">Incident</h1>
          <div className="mt-2 text-accent text-sm">ID: <span className="font-mono">{incidentId}</span></div>
          {loading ? (
            <div className="mt-4 text-accent">Loading…</div>
          ) : (
            <div className="mt-4 space-y-2 text-main-text">
              <div>
                <span className="text-accent">Wolf ID:</span>
                <span className="ml-2 font-mono">{incident?.wolfId || '—'}</span>
              </div>
              <div>
                <span className="text-accent">Incident Status:</span>
                <span className="ml-2">{incident?.status || '—'}</span>
              </div>
              {incident?.type && (
                <div>
                  <span className="text-accent">Crisis Type:</span>
                  <span className="ml-2">{CRISIS_LABELS[incident.type] || incident.type}</span>
                </div>
              )}
              <div>
                <span className="text-accent">Twilio Status:</span>
                <span className="ml-2">{incident?.twilioStatus || '—'}</span>
              </div>
              <div>
                <span className="text-accent">Duration (seconds):</span>
                <span className="ml-2">{typeof incident?.durationSeconds === 'number' ? incident?.durationSeconds : '—'}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}


