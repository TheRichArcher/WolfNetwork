'use client';

import { useMemo, useRef, useState } from 'react';
import Layout from '@/components/Layout';

const LONG_PRESS_MS = 600;

const HotlinePage = () => {
  const [isActivated, setIsActivated] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [status, setStatus] = useState('Idle');

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

  const activateHotline = () => {
    setIsActivated(true);
    setIsConnecting(true);
    setStatus('Connecting…');
    setTimeout(() => {
      setIsConnecting(false);
      setIsConnected(true);
      setStatus('Connected. Operator on the line.');
      if ('vibrate' in navigator) navigator.vibrate([20, 40, 20]);
    }, 5000);
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
                <div className="p-4 border border-accent rounded" role="button" tabIndex={0}>Legal</div>
                <div className="p-4 border border-accent rounded" role="button" tabIndex={0}>Medical</div>
                <div className="p-4 border border-accent rounded" role="button" tabIndex={0}>PR</div>
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
      </div>
      {isActivated && renderOverlay}
    </Layout>
  );
};

export default HotlinePage;

