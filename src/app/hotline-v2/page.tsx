'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Layout from '@/components/Layout';
import CrisisSelector, { type CrisisType } from '@/components/CrisisSelector';
import posthog from 'posthog-js';

type CallStatus = 'idle' | 'queued' | 'ringing' | 'connected' | 'ended';

export default function HotlineV2Page() {
  const { status } = useSession();
  const [wolfId, setWolfId] = useState<string>('');
  const [isActivating, setIsActivating] = useState(false);
  const [callStatus, setCallStatus] = useState<CallStatus>('idle');
  const [incidentId, setIncidentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [crisisType, setCrisisType] = useState<CrisisType | null>(null);
  const [callDuration, setCallDuration] = useState<number>(0);
  const [callStartTime, setCallStartTime] = useState<number | null>(null);

  // Derived state
  const isConnected = callStatus === 'connected';
  const isRinging = callStatus === 'ringing' || callStatus === 'queued';

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
            if (callStatus !== 'connected') {
              setCallStatus('connected');
              setCallStartTime(Date.now());
            }
            setIsActivating(false);
          } else if (s === 'ringing') {
            setCallStatus('ringing');
            setIsActivating(false);
          } else if (s === 'queued' || s === 'initiated') {
            setCallStatus('queued');
          } else if (TERMINAL.has(s)) {
            setCallStatus('ended');
            setIsActivating(false);
            // Reset after showing ended state briefly
            setTimeout(() => {
              if (!cancelled) {
                setCallStatus('idle');
                setIncidentId(null);
                setCrisisType(null);
                setCallDuration(0);
                setCallStartTime(null);
              }
            }, 3000);
          }
        })
        .catch(() => {});
    };

    poll();
    const timer = window.setInterval(poll, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [incidentId, callStatus]);

  // Track call duration
  useEffect(() => {
    if (!callStartTime || callStatus !== 'connected') return;
    
    const timer = window.setInterval(() => {
      setCallDuration(Math.floor((Date.now() - callStartTime) / 1000));
    }, 1000);
    
    return () => window.clearInterval(timer);
  }, [callStartTime, callStatus]);

  // Auto-dismiss errors
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), 5000);
    return () => clearTimeout(timer);
  }, [error]);

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

  const handleEndCall = useCallback(async () => {
    if (!incidentId) return;
    
    try {
      await fetch('/api/hotline/end-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ incidentId }),
      });
      setCallStatus('ended');
      setTimeout(() => {
        setCallStatus('idle');
        setIncidentId(null);
        setCrisisType(null);
        setCallDuration(0);
        setCallStartTime(null);
      }, 2000);
    } catch {
      setError('Failed to end call');
    }
  }, [incidentId]);

  // Format duration as mm:ss
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
          isActivating={isActivating || isRinging}
          isConnected={isConnected}
        />

        {/* Call status feedback */}
        {isRinging && (
          <div className="mt-6 flex items-center gap-2 text-amber-400">
            <span className="animate-pulse">●</span>
            <span className="text-sm">Ringing operator...</span>
          </div>
        )}

        {/* Connected state with duration */}
        {isConnected && (
          <div className="mt-6 space-y-4 text-center">
            <div className="flex items-center justify-center gap-3">
              <span className="text-green-400 text-lg">●</span>
              <span className="text-main-text font-medium">Connected</span>
              <span className="text-accent font-mono">{formatDuration(callDuration)}</span>
            </div>
            <button
              onClick={handleEndCall}
              className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
            >
              End Call
            </button>
          </div>
        )}

        {/* Ended state */}
        {callStatus === 'ended' && (
          <div className="mt-6 text-accent text-sm">
            Call ended
          </div>
        )}

        {/* Error display with retry */}
        {error && (
          <div className="mt-4 flex flex-col items-center gap-2">
            <p className="text-red-400 text-sm" role="alert">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-xs text-accent hover:text-main-text underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Crisis type indicator when active */}
        {crisisType && (isActivating || isRinging || isConnected) && (
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
