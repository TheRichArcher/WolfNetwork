'use client';

import { useMemo, useRef, useState } from 'react';
import posthog from 'posthog-js';
import Layout from '@/components/Layout';

const LONG_PRESS_MS = 600;

const HotlinePage = () => {
  const [isActivated, setIsActivated] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [status, setStatus] = useState('Idle');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);

  const pressTimerRef = useRef<number | null>(null);
  const isPressingRef = useRef(false);

  const startPress = () => {
    isPressingRef.current = true;
    setStatus('Hold to activate…');
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
    setStatus('Idle');
  };

  const activateHotline = async () => {
    setIsActivated(true);
    setIsConnecting(true);
    setIsConnected(false);
    setError(null);
    setStatus('Connecting…');

    try {
      const resp = await fetch('/api/hotline/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: phone }),
      });
      const data = await resp.json();
      if (!resp.ok || !data?.success) throw new Error(data?.error || 'Failed to start call');
      setIsConnecting(false);
      setIsConnected(true);
      setStatus(`Connected. Operator on the line. ETA: ${data.etaMinutes} min`);
      if ('vibrate' in navigator) navigator.vibrate([20, 40, 20]);
      try { posthog.capture('hotline_activated', { eta: data.etaMinutes }); } catch {}
    } catch (e: unknown) {
      setIsConnecting(false);
      setIsConnected(false);
      setStatus('Could not connect');
      setError(e instanceof Error ? e.message : 'Unknown error');
    }
  };

  const renderOverlay = useMemo(() => (
    <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex flex-col items-center justify-center animate-fadeIn">
      <div className="bg-alert bg-opacity-20 absolute inset-0" />
      <div className="relative z-10 text-center" aria-live="polite">
        {isConnecting && (
          <>
            <div className="w-32 h-32 border-8 border-t-main-text border-border rounded-full animate-spin mx-auto" aria-label="Connecting" />
            <p className="text-2xl mt-8">Connecting…</p>
          </>
        )}
        {isConnected && (
          <div>
            <h2 className="text-3xl font-bold">Connected</h2>
            <p className="mt-4 text-accent">Operator is on the line.</p>
            <div className="mt-8">
              <h3 className="text-xl font-bold">Categorize Crisis</h3>
              <div className="flex gap-4 mt-4">
                <div className="p-4 border border-accent rounded" role="button" tabIndex={0} onClick={() => { try { posthog.capture('hotline_category_selected', { category: 'Legal' }); } catch {} }}>Legal</div>
                <div className="p-4 border border-accent rounded" role="button" tabIndex={0} onClick={() => { try { posthog.capture('hotline_category_selected', { category: 'Medical' }); } catch {} }}>Medical</div>
                <div className="p-4 border border-accent rounded" role="button" tabIndex={0} onClick={() => { try { posthog.capture('hotline_category_selected', { category: 'PR' }); } catch {} }}>PR</div>
              </div>
              <p className="mt-8 text-2xl">Partner ETA: 2 min</p>
            </div>
          </div>
        )}
      </div>
    </div>
  ), [isConnecting, isConnected]);

  return (
    <Layout>
      <div className="flex flex-col items-center justify-center p-4 text-center">
        <h1 className="text-3xl font-bold">Crisis Hotline</h1>
        <p className="text-accent mt-4 max-w-md">
          Press and hold to activate. Release to cancel before activation.
        </p>
        <div className="mt-6 flex items-center gap-2">
          <input
            type="tel"
            inputMode="tel"
            placeholder="Your phone (E.164 e.g. +13105551234)"
            className="px-3 py-2 rounded border border-border bg-transparent"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            aria-label="Phone number to reach you"
          />
        </div>
        <button
          onPointerDown={startPress}
          onPointerUp={endPress}
          onPointerLeave={endPress}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') startPress(); }}
          onKeyUp={endPress}
          aria-pressed={isActivated}
          aria-label="Activate hotline"
          className="mt-8 w-48 h-48 bg-alert rounded-full flex items-center justify-center text-main-text text-2xl font-bold shadow-lg select-none animate-redPulse"
        >
          Activate
        </button>
        <p className="mt-4 text-sm text-accent" aria-live="polite">{status}</p>
        {error && <p className="mt-2 text-sm text-red-400" role="alert">{error}</p>}
      </div>
      {isActivated && renderOverlay}
    </Layout>
  );
};

export default HotlinePage;

