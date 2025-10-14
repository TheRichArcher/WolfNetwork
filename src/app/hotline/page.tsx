"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import posthog from 'posthog-js';
import Layout from '@/components/Layout';
import HotlineButton from '@/components/HotlineButton';

const LONG_PRESS_MS = 1500;

const HotlinePage = () => {
  const [isActivated, setIsActivated] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [status, setStatus] = useState('idle');
  const [incidentId, setIncidentId] = useState<string | null>(null);
  const [wolfId, setWolfId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const endMessageTimerRef = useRef<number | null>(null);
  const [isPressing, setIsPressing] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);

  const pressTimerRef = useRef<number | null>(null);
  const isPressingRef = useRef(false);

  const startPress = () => {
    isPressingRef.current = true;
    setIsPressing(true);
    setStatus('Hold to activate — release to cancel');
    if ('vibrate' in navigator) navigator.vibrate(10);
    pressTimerRef.current = window.setTimeout(() => {
      if (!isPressingRef.current) return;
      activateHotline();
    }, LONG_PRESS_MS);
    // Animate progress
    const started = performance.now();
    const tick = () => {
      if (!isPressingRef.current) return;
      const elapsed = performance.now() - started;
      setHoldProgress(Math.min(1, elapsed / LONG_PRESS_MS));
      if (elapsed < LONG_PRESS_MS) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  const endPress = () => {
    isPressingRef.current = false;
    setIsPressing(false);
    setHoldProgress(0);
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
    if (!isActivated && !isActivating) setStatus('idle');
  };

  const activateHotline = async () => {
    setIsActivating(true);
    setError(null);
    try {
      const resp = await fetch('/api/hotline/activate', { method: 'POST' });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || 'Activation failed');
      if (data?.incidentId) setIncidentId(data.incidentId);
      setIsActivated(true);
      setIsActivating(false);
      setStatus('Connected');
      try { posthog.capture('hotline_activated', { wolfId: data?.wolfId }); } catch {}
      if ('vibrate' in navigator) navigator.vibrate([30, 50, 30]);
    } catch (e: unknown) {
      setStatus('idle');
      setIsActivated(false);
      setIsActivating(false);
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

  // Poll active session to reflect live call status and auto-reset UI after call ends
  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;
    const TERMINAL = new Set(['completed', 'busy', 'no-answer', 'failed', 'canceled']);
    const load = () => {
      const url = incidentId ? `/api/incident/${encodeURIComponent(incidentId)}` : '/api/me/active-session';
      fetch(url)
        .then(async (r) => (r.ok ? r.json() : null))
        .then((j) => {
          if (!j || cancelled) return;
          const twilioStatus: string | undefined = j.twilioStatus;
          const statusStr = typeof j?.status === 'string' ? j.status.toLowerCase() : '';
          const active: boolean = incidentId
            ? (statusStr === 'active' || statusStr === 'initiated' || twilioStatus === 'ringing' || twilioStatus === 'in-progress' || twilioStatus === 'answered')
            : Boolean(j.active);
          if (active) {
            if (!isActivated) setIsActivated(true);
            const s = (twilioStatus || '').toLowerCase();
            if (s === 'queued' || s === 'initiated' || s === 'ringing') setStatus('Connecting…');
            else setStatus('In Progress');
          } else {
            // If call ended and we have a final status, show it briefly then reset to idle
            if (twilioStatus && TERMINAL.has(twilioStatus)) {
              const duration = typeof j.durationSeconds === 'number' ? j.durationSeconds : undefined;
              const endedMsg = `Ended: ${twilioStatus}${typeof duration === 'number' ? ` (${duration}s)` : ''}`;
              setStatus(endedMsg);
              setIsActivated(false);
              setIncidentId(null);
              if (endMessageTimerRef.current) {
                window.clearTimeout(endMessageTimerRef.current);
                endMessageTimerRef.current = null;
              }
              endMessageTimerRef.current = window.setTimeout(() => {
                setStatus('idle');
              }, 8000);
            } else if (!twilioStatus) {
              // If we have an incident and it's in 'initiated' state, keep UI in Connecting
              if (statusStr === 'initiated') {
                if (!isActivated) setIsActivated(true);
                setStatus('Connecting…');
              } else {
                // No status available; ensure UI is reset only when not initiated
                setIsActivated(false);
                setIncidentId(null);
                setStatus('idle');
              }
            }
          }
        })
        .catch(() => {});
    };
    load();
    timer = window.setInterval(load, 5000);
    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
      if (endMessageTimerRef.current) window.clearTimeout(endMessageTimerRef.current);
    };
  }, [isActivated, status, incidentId]);

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
        <HotlineButton
          session={{ active: isActivated }}
          isPressing={isPressing}
          isActivating={isActivating}
          holdProgress={holdProgress}
          onPointerDown={startPress}
          onPointerUp={endPress}
          onPointerLeave={endPress}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') startPress(); }}
          onKeyUp={endPress}
          aria-label="Activate Crisis Hotline (long press)"
        />
        <p className="mt-4 text-sm text-accent" aria-live="polite">{status}</p>
        {error && <p className="mt-2 text-sm text-red-400" role="alert">{error}</p>}
      </div>
      {(isActivating || isActivated) && overlay}
    </Layout>
  );
};

export default HotlinePage;

