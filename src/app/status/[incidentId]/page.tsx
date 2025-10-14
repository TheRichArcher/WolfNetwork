'use client';

import { useEffect, useState } from 'react';
import Layout from '@/components/Layout';

type Incident = {
  id: string;
  wolfId?: string;
  status?: string;
  twilioStatus?: string;
  createdAt?: string;
  resolvedAt?: string | null;
  durationSeconds?: number;
};

export default function IncidentStatusPage({ params }: { params: { incidentId: string } }) {
  const { incidentId } = params;
  const [incident, setIncident] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;
    const load = async () => {
      try {
        const r = await fetch('/api/me/active-session');
        if (!r.ok) return;
        const j = await r.json();
        if (cancelled) return;
        if (j && j.incidentId === incidentId) {
          setIncident({
            id: j.incidentId,
            wolfId: j.wolfId,
            status: j.status,
            twilioStatus: j.twilioStatus,
            createdAt: j.startedAt,
            resolvedAt: j.isTerminal ? j.startedAt : null,
            durationSeconds: j.durationSeconds,
          });
        } else if (!j?.active) {
          // Not active; keep minimal details
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


