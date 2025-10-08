'use client';

import { useEffect, useState } from 'react';

const RelayStatus = () => {
  const [region, setRegion] = useState<string>('');
  const [latency, setLatency] = useState<number | null>(null);
  const [healthy, setHealthy] = useState<boolean>(true);
  useEffect(() => {
    let cancelled = false;
    const ping = async () => {
      const started = performance.now();
      try {
        const r = await fetch('/api/me');
        if (r.ok) {
          const j = await r.json();
          if (!cancelled) setRegion(j.region || '');
          if (!cancelled) setLatency(Math.round(performance.now() - started));
          if (!cancelled) setHealthy(true);
        } else {
          if (!cancelled) setHealthy(false);
        }
      } catch {
        if (!cancelled) setHealthy(false);
      }
    };
    ping();
    const id = window.setInterval(ping, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);
  return (
    <div className="px-4 py-1 text-center text-[10px] text-gray-400 border-t border-border">
      {healthy ? 'Secure Relay Active' : 'Secure Relay Degraded'} — {region || '—'} Node — {latency != null ? `${latency}ms latency` : '…'}
    </div>
  );
};

export default RelayStatus;


