'use client';

import { useEffect, useRef, useState } from 'react';
import SplashScreen from '@/components/SplashScreen';
import Layout from '@/components/Layout';
import CardCarousel from '@/components/CardCarousel';

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [userTier, setUserTier] = useState<string | null>(null);
  const [wolfId, setWolfId] = useState<string>('');
  const [region, setRegion] = useState<string>('');
  const [team, setTeam] = useState<Array<{ category: string; name: string; status: string }>>([]);
  const [lastActivation, setLastActivation] = useState<{ createdAt?: string; resolvedAt?: string | null; operatorId?: string | null } | null>(null);
  const [readiness, setReadiness] = useState<{ twoFA: boolean; profileVerified: boolean; hasPin: boolean; percent: number }>({ twoFA: false, profileVerified: false, hasPin: false, percent: 0 });
  const [packStatus, setPackStatus] = useState<string>('Pack Ready');
  const [partnersPresence, setPartnersPresence] = useState<Array<{ category: string; name: string; status: 'Active' | 'Rotating' | 'Offline' }>>([]);
  const [activeSession, setActiveSession] = useState<{ active: boolean; sessionSid?: string; incidentId?: string; operator?: string; startedAt?: string } | null>(null);

  // Hotline long-press behavior (mirrors /hotline)
  const LONG_PRESS_MS = 1500;
  const [isActivating, setIsActivating] = useState(false);
  const [hotlineStatus, setHotlineStatus] = useState('Idle');
  const [hotlineError, setHotlineError] = useState<string | null>(null);
  const pressTimerRef = useRef<number | null>(null);
  const isPressingRef = useRef(false);

  const startPress = () => {
    isPressingRef.current = true;
    setHotlineError(null);
    setHotlineStatus('Dispatching operator…');
    if ('vibrate' in navigator) navigator.vibrate(10);
    pressTimerRef.current = window.setTimeout(async () => {
      if (!isPressingRef.current) return;
      setIsActivating(true);
      try {
        const resp = await fetch('/api/activate-hotline', { method: 'POST' });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data?.error || 'Activation failed');
        setHotlineStatus('Connected to operator');
        if ('vibrate' in navigator) navigator.vibrate([30, 50, 30]);
      } catch {
        setHotlineStatus('Failed');
        setHotlineError('Something went wrong. Try again or contact support.');
        setIsActivating(false);
      }
    }, LONG_PRESS_MS);
  };
  const endPress = () => {
    isPressingRef.current = false;
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
    if (!isActivating) setHotlineStatus('Idle');
  };

  useEffect(() => {
    try {
      const fromLocalStorage = typeof window !== 'undefined' ? localStorage.getItem('userTier') : null;
      if (fromLocalStorage) {
        setUserTier(fromLocalStorage);
        return;
      }
      const cookieMatch = typeof document !== 'undefined' ? document.cookie.match(/(?:^|; )userTier=([^;]+)/) : null;
      if (cookieMatch) setUserTier(decodeURIComponent(cookieMatch[1]));
    } catch {
      // ignore read errors
    }
  }, []);

  // load identity and region
  useEffect(() => {
    let cancelled = false;
    fetch('/api/me')
      .then(async (r) => {
        if (!r.ok) return;
        const j = await r.json();
        if (!cancelled) {
          setWolfId(j.wolfId || '');
          setRegion(j.region || '');
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // load team
  useEffect(() => {
    let cancelled = false;
    fetch('/api/me/team')
      .then(async (r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j || cancelled) return;
        const list = j.team || [];
        setTeam(list);
        const anyOffline = list.some((m: { status: string }) => m.status === 'Offline');
        setPackStatus(anyOffline ? 'Pack on Standby' : 'Pack Ready');
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // presence polling every 60s
  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;
    const load = () => {
      fetch('/api/partners/presence')
        .then(async (r) => (r.ok ? r.json() : null))
        .then((j) => {
          if (!j || cancelled) return;
          const partners = (j.partners || []) as Array<{ category: string; name: string; status: 'Active' | 'Rotating' | 'Offline' }>;
          setPartnersPresence(partners);
        })
        .catch(() => {});
    };
    load();
    timer = window.setInterval(load, 60000);
    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
    };
  }, []);

  // active session polling
  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;
    const load = () => {
      fetch('/api/me/active-session')
        .then(async (r) => (r.ok ? r.json() : null))
        .then((j) => {
          if (!j || cancelled) return;
          setActiveSession(j);
        })
        .catch(() => {});
    };
    load();
    timer = window.setInterval(load, 15000);
    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
    };
  }, []);

  // load last incident summary
  useEffect(() => {
    let cancelled = false;
    fetch('/api/me/last-incident')
      .then(async (r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j || cancelled) return;
        setLastActivation(j);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // load readiness from server
  useEffect(() => {
    let cancelled = false;
    fetch('/api/me/security-status')
      .then(async (r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j || cancelled) return;
        setReadiness({
          twoFA: Boolean(j.twoFA),
          profileVerified: Boolean(j.profileVerified),
          hasPin: Boolean(j.securePIN),
          percent: typeof j.percent === 'number' ? j.percent : 0,
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // fake relay latency by pinging a lightweight endpoint (or measure /api/me)
  useEffect(() => {
    let cancelled = false;
    const start = performance.now();
    fetch('/api/me').catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      {loading ? (
        <SplashScreen onFinished={() => setLoading(false)} />
      ) : (
        <Layout>
          <div className="p-4 space-y-7">
            <section className="bg-surface rounded-lg p-5 border border-border hover:border-cta/30 hover:bg-surface-2/40 transition-colors">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-main-text">Crisis Hotline — Hold to Activate</h2>
                  <p className="text-accent mt-1">Your Wolf ID: <span className="font-mono">{wolfId || '—'}</span> | Status: <span className="text-cta">{packStatus}</span></p>
                </div>
                {/* Hidden dashboard shortcut: open dedicated hotline page when we add live session view */}
              </div>
              {activeSession?.active ? (
                <div className="mt-4">
                  <div className="text-accent text-sm">Live call in progress. See Active Session card below.</div>
                </div>
              ) : (
                <div className="mt-4 flex items-center gap-4">
                  <button
                    onPointerDown={startPress}
                    onPointerUp={endPress}
                    onPointerLeave={endPress}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') startPress(); }}
                    onKeyUp={endPress}
                    aria-pressed={isActivating}
                    aria-label="Activate hotline"
                    disabled={isActivating}
                    aria-disabled={isActivating}
                    className={`w-24 h-24 rounded-full flex items-center justify-center text-main-text text-sm font-bold shadow-lg select-none ${isActivating ? 'bg-gray-700' : 'bg-alert animate-redPulse'}`}
                  >
                    {isActivating ? 'Dispatching…' : 'Activate'}
                  </button>
                  <div className={`text-sm ${hotlineStatus === 'Failed' ? 'text-red-400' : 'text-accent'}`} aria-live="polite">{hotlineStatus}</div>
                </div>
              )}
              {hotlineError && (
                <div className="mt-2 text-xs text-red-400" role="alert" aria-live="polite">{hotlineError}</div>
              )}
            </section>

            <section className="bg-surface rounded-lg p-5 border border-border hover:border-cta/30 hover:bg-surface-2/40 transition-colors">
              <h2 className="text-lg font-semibold text-main-text">My Wolf Team</h2>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(partnersPresence.length > 0 ? partnersPresence : team).map((m) => (
                  <div key={`${m.category}-${m.name}`} className="flex items-center justify-between bg-surface-2 border border-border rounded px-3 py-2">
                    <div className="text-main-text">
                      <div className="text-sm">{m.category}</div>
                      <div className="text-lg font-semibold">{m.name.split(' ')[0]}</div>
                    </div>
                    <div className={`text-xs ${m.status === 'Active' ? 'text-green-400' : m.status === 'Rotating' ? 'text-gray-300' : 'text-red-400'}`}>
                      {m.status === 'Active' ? '🟢 Active' : m.status === 'Rotating' ? '⚪ Rotating' : '🔴 Offline'}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {activeSession?.active ? (
              <section className="bg-surface rounded-lg p-5 border border-border hover:border-cta/30 hover:bg-surface-2/40 transition-colors">
                <h2 className="text-lg font-semibold text-main-text">Active Session</h2>
                <div className="mt-2 text-accent text-sm flex items-center justify-between">
                  <div>
                    <div>Operator: <span className="text-main-text">{activeSession.operator || 'Operator'}</span></div>
                    <div className="mt-1">Started: {activeSession.startedAt ? new Date(activeSession.startedAt).toLocaleTimeString() : '—'}</div>
                  </div>
                  <button
                    className="ml-4 px-3 py-2 rounded bg-alert text-main-text text-sm"
                    onClick={async () => {
                      if (!activeSession?.sessionSid || !activeSession?.incidentId) return;
                      try {
                        const r = await fetch('/api/resolve-hotline', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ sessionSid: activeSession.sessionSid, incidentId: activeSession.incidentId }),
                        });
                        if (r.ok) {
                          setActiveSession({ active: false });
                        }
                      } catch {}
                    }}
                  >
                    End Session
                  </button>
                </div>
              </section>
            ) : null}

            <section className="bg-surface rounded-lg p-5 border border-border hover:border-cta/30 hover:bg-surface-2/40 transition-colors">
              <h2 className="text-lg font-semibold text-main-text">Last Activation</h2>
              <div className="mt-2 text-accent text-sm">
                {lastActivation?.createdAt ? (
                  <>
                    <div>
                      Last Activation: {formatDaysAgo(lastActivation.createdAt)}
                    </div>
                    {lastActivation?.resolvedAt && (
                      <div>
                        Resolved in {formatMinutesDiff(lastActivation.createdAt!, lastActivation.resolvedAt)}
                      </div>
                    )}
                    {lastActivation?.operatorId && (
                      <div>Operator {lastActivation.operatorId}</div>
                    )}
                  </>
                ) : (
                  <div>No prior activations.</div>
                )}
              </div>
            </section>

            <section className="bg-surface rounded-lg p-5 border border-border hover:border-cta/30 hover:bg-surface-2/40 transition-colors">
              <h2 className="text-lg font-semibold text-main-text">Wolf Readiness Score</h2>
              <div className="mt-2 flex items-center justify-between">
                <div className="flex-1 h-2 bg-surface-2 rounded mr-3">
                  <div className="h-2 bg-cta rounded" style={{ width: `${readiness.percent}%` }} />
                </div>
                <div className="text-accent text-sm">Wolf Readiness: {readiness.percent}%</div>
              </div>
              <ul className="mt-3 space-y-1 text-sm text-accent">
                <li>{readiness.twoFA ? '✅ 2FA Enabled' : '⚠️ 2FA Not Enabled'}</li>
                <li>{readiness.profileVerified ? '✅ Profile Verified' : '⚠️ Profile Not Verified'}</li>
                <li>{readiness.hasPin ? '✅ Secure PIN Set' : '⚠️ Secure PIN Missing'}</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold">At-a-Glance</h2>
              <div className="h-0.5 w-12 bg-cta mb-4" aria-hidden="true" />
              <CardCarousel />
            </section>

            {userTier === 'Platinum' && (
              <section className="bg-surface rounded-lg p-5 border border-border hover:border-cta/30 hover:bg-surface-2/40 transition-colors">
                <h2 className="text-lg font-semibold text-main-text">Platinum Tools</h2>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-accent text-sm">
                  <div className="bg-surface-2 border border-border rounded px-3 py-3">
                    <div className="font-semibold text-main-text">Secure Vault Access</div>
                    <div>Incident and NDA archive</div>
                  </div>
                  <div className="bg-surface-2 border border-border rounded px-3 py-3">
                    <div className="font-semibold text-main-text">Alias Number Pool</div>
                    <div>Rotating relay numbers</div>
                  </div>
                  <div className="bg-surface-2 border border-border rounded px-3 py-3">
                    <div className="font-semibold text-main-text">Direct Operator Channel</div>
                    <div>Encrypted chat link</div>
                  </div>
                </div>
              </section>
            )}
          </div>
        </Layout>
      )}
    </div>
  );
}

function formatDaysAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const days = Math.max(0, Math.floor((now - then) / (1000 * 60 * 60 * 24)));
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function formatMinutesDiff(startIso: string, endIso: string): string {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  const mins = Math.max(0, Math.round((end - start) / (1000 * 60)));
  return `${mins} minute${mins === 1 ? '' : 's'}`;
}
