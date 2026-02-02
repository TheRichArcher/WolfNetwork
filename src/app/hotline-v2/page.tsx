'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Layout from '@/components/Layout';
import CrisisSelector, { type CrisisType } from '@/components/CrisisSelector';
import posthog from 'posthog-js';

export default function HotlineV2Page() {
  const { status } = useSession();
  const [wolfId, setWolfId] = useState<string>('');
  const [isActivating, setIsActivating] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [incidentId, setIncidentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [crisisType, setCrisisType] = useState<CrisisType | null>(null);

  // Load wolf ID
  useEffect(() => {
    let cancelled = false;
    fetch('/api/me')
      .then(async (r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!cancelled && j?.wolfId) setWolfId(j.wolfId);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Poll for call status
  useEffect(() => {
    if (!incidentId) return;
    
    let cancelled = false;
    const TERMINAL = new Set(['completed', 'busy', 'no-answer', 'failed', 'canceled']);
    
    const poll = () => {
      fetch(`/api/incident/${encodeURIComponent(incidentId)}`)
        .then(async (r) => (r.ok ? r.json() : null))
        .then((j) => {
          if (!j || cancelled) return;
          const s = (j.twilioStatus || '').toLowerCase();
          
          if (s === 'in-progress' || s === 'answered') {
            setIsConnected(true);
            setIsActivating(false);
          } else if (TERMINAL.has(s)) {
            setIsConnected(false);
            setIsActivating(false);
            setIncidentId(null);
            setCrisisType(null);
          }
        })
        .catch(() => {});
    };

    poll();
    const timer = window.setInterval(poll, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [incidentId]);

  const handleActivate = async (type: CrisisType) => {
    setCrisisType(type);
    setIsActivating(true);
    setError(null);

    try {
      const resp = await fetch('/api/hotline/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ crisisType: type }),
      });
      const data = await resp.json();
      
      if (!resp.ok) throw new Error(data?.error || 'Activation failed');
      
      setIncidentId(data.incidentId);
      if ('vibrate' in navigator) navigator.vibrate([30, 50, 30]);
      
      try { 
        posthog.capture('hotline_activated_v2', { wolfId, crisisType: type }); 
      } catch {}
      
    } catch (e) {
      setIsActivating(false);
      setError(e instanceof Error ? e.message : 'Unknown error');
    }
  };

  const handleEndCall = async () => {
    if (!incidentId) return;
    
    try {
      await fetch('/api/hotline/end-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ incidentId }),
      });
      setIsConnected(false);
      setIncidentId(null);
      setCrisisType(null);
    } catch {
      setError('Failed to end call');
    }
  };

  if (status === 'loading') {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-pulse text-accent">Loading...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-4">
        {/* Header - minimal */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-main-text">Crisis Hotline</h1>
          <p className="text-accent text-sm mt-1">
            Wolf ID: <span className="font-mono">{wolfId || '—'}</span>
          </p>
        </div>

        {/* The Magic: Category + Button */}
        <CrisisSelector
          onActivate={handleActivate}
          isActivating={isActivating}
          isConnected={isConnected}
        />

        {/* End call button when connected */}
        {isConnected && (
          <button
            onClick={handleEndCall}
            className="mt-6 px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            End Call
          </button>
        )}

        {/* Error display */}
        {error && (
          <p className="mt-4 text-red-400 text-sm" role="alert">
            {error}
          </p>
        )}

        {/* Crisis type indicator when active */}
        {crisisType && (isActivating || isConnected) && (
          <div className="mt-6 px-4 py-2 bg-surface-2 rounded-lg border border-border">
            <span className="text-accent text-sm">
              {crisisType.charAt(0).toUpperCase() + crisisType.slice(1)} Support
            </span>
          </div>
        )}
      </div>
    </Layout>
  );
}
