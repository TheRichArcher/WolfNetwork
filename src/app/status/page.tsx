'use client';

import { useEffect, useState } from 'react';
import Layout from '@/components/Layout';

type ActiveSession = {
  active: boolean;
  status?: string;
  wolfId?: string;
  twilioStatus?: string;
  durationSeconds?: number;
};

export default function StatusPage() {
  const [session, setSession] = useState<ActiveSession>({ active: false });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;
    const load = () => {
      fetch('/api/me/active-session')
        .then(async (r) => (r.ok ? r.json() : null))
        .then((j) => {
          if (!j || cancelled) return;
          setSession(j);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    };
    load();
    timer = window.setInterval(load, 5000);
    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
    };
  }, []);

  return (
    <Layout>
      <div className="p-4">
        <div className="bg-surface rounded-lg p-6 border border-border animate-fadeIn">
          <h1 className="text-2xl font-bold text-main-text">Hotline Status</h1>
          {loading ? (
            <div className="mt-3 text-accent">Loading…</div>
          ) : (
            <div className="mt-4 space-y-2 text-main-text">
              <div>
                <span className="text-accent">Wolf ID:</span>
                <span className="ml-2 font-mono">{session.wolfId || '—'}</span>
              </div>
              <div>
                <span className="text-accent">Incident Status:</span>
                <span className="ml-2">{session.status || (session.active ? 'active' : 'inactive')}</span>
              </div>
              <div>
                <span className="text-accent">Twilio Status:</span>
                <span className="ml-2">{session.twilioStatus || '—'}</span>
              </div>
              <div>
                <span className="text-accent">Duration (seconds):</span>
                <span className="ml-2">{typeof session.durationSeconds === 'number' ? session.durationSeconds : '—'}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}


