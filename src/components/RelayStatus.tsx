'use client';

import { useEffect, useState } from 'react';

const RelayStatus = () => {
  const [region, setRegion] = useState<string>('');
  const [latency, setLatency] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    const started = performance.now();
    fetch('/api/me')
      .then(async (r) => {
        if (!r.ok) return;
        const j = await r.json();
        if (!cancelled) setRegion(j.region || '');
      })
      .catch(() => {});
    fetch('/api/me')
      .then(() => {
        if (cancelled) return;
        setLatency(Math.round(performance.now() - started));
      })
      .catch(() => setLatency(null));
    return () => {
      cancelled = true;
    };
  }, []);
  return (
    <div className="px-4 py-1 text-center text-[10px] text-gray-400 border-t border-border">
      Secure Relay Active: {region || '—'} Node — {latency != null ? `${latency}ms` : '…'}
    </div>
  );
};

export default RelayStatus;


