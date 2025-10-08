"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import posthog from 'posthog-js';
import Layout from '@/components/Layout';

const LONG_PRESS_MS = 1500;

const HotlinePage = () => {
  const [isActivated, setIsActivated] = useState(false);
  const [status, setStatus] = useState('Idle');
  const [wolfId, setWolfId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const pressTimerRef = useRef<number | null>(null);
  const isPressingRef = useRef(false);

  const startPress = () => {
    isPressingRef.current = true;
    setStatus('Activating…');
    if ('vibrate' in navigator) navigator.vibrate(10);
    pressTimerRef.current = window.setTimeout(() => {
      if (!isPressingRef.current) return;
      activateHotline();
    }, LONG_PRESS_MS);
  };

  const endPress = () => {
    isPressingRef.current = false;
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
    if (!isActivated) setStatus('Idle');
  };

  const activateHotline = async () => {
    setIsActivated(true);
    setError(null);
    try {
      const resp = await fetch('/api/activate-hotline', { method: 'POST' });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || 'Activation failed');
      setStatus('Connected');
      try { posthog.capture('hotline_activated', { wolfId: data?.wolfId }); } catch {}
      if ('vibrate' in navigator) navigator.vibrate([30, 50, 30]);
    } catch (e: unknown) {
      setStatus('Idle');
      setIsActivated(false);
      setError(e instanceof Error ? e.message : 'Unknown error');
    }
  };

  useEffect(() => {
    let cancelled = false;
    fetch('/api/me').then(async (r) => {
      if (!r.ok) return;
      const j = await r.json();
      if (!cancelled) setWolfId(j.wolfId || '');
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const overlay = useMemo(() => (
    <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex flex-col items-center justify-center animate-fadeIn">
      <div className="bg-alert bg-opacity-20 absolute inset-0" />
      <div className="relative z-10 text-center" aria-live="polite">
        <h2 className="text-3xl font-bold">Dispatching operator</h2>
        <p className="mt-4 text-accent">Please remain available.</p>
      </div>
    </div>
  ), []);

  return (
    <Layout>
      <div className="flex flex-col items-center justify-center p-4 text-center">
        <h1 className="text-3xl font-bold">Crisis Hotline</h1>
        <p className="text-accent mt-2 text-sm">Wolf ID: <span className="font-mono">{wolfId || '—'}</span></p>
        <p className="text-accent mt-4 max-w-md">Press and hold to activate. Release to cancel before activation.</p>
        <button
          onPointerDown={startPress}
          onPointerUp={endPress}
          onPointerLeave={endPress}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') startPress(); }}
          onKeyUp={endPress}
          aria-pressed={isActivated}
          aria-label="Activate hotline"
          disabled={isActivated}
          aria-disabled={isActivated}
          className={`mt-8 w-48 h-48 rounded-full flex items-center justify-center text-main-text text-2xl font-bold shadow-lg select-none ${isActivated ? 'bg-gray-700' : 'bg-alert animate-redPulse'}`}
        >
          Activate
        </button>
        <p className="mt-4 text-sm text-accent" aria-live="polite">{status}</p>
        {error && <p className="mt-2 text-sm text-red-400" role="alert">{error}</p>}
      </div>
      {isActivated && overlay}
    </Layout>
  );
};

export default HotlinePage;

