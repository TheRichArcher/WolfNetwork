'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import SplashScreen from '@/components/SplashScreen';
import Layout from '@/components/Layout';
import CardCarousel from '@/components/CardCarousel';
import HotlineButton from '@/components/HotlineButton';
import posthog from 'posthog-js';

export const dynamic = "force-dynamic";

export default function Home() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      try {
        const validated = typeof window !== 'undefined' && localStorage.getItem('inviteValidated') === '1';
        router.push(validated ? '/api/auth/signin' : '/signup');
      } catch {
        router.push('/signup');
      }
    }
  }, [status, router]);

  const [loading, setLoading] = useState(true);
  const [userTier, setUserTier] = useState<string | null>(null);
  const [wolfId, setWolfId] = useState<string>('');
  // const [region, setRegion] = useState<string>(''); // reserved for future UI
  const [team, setTeam] = useState<Array<{ category: string; name: string; status: string }>>([]);
  const [lastActivation, setLastActivation] = useState<{ createdAt?: string; resolvedAt?: string | null; operatorId?: string | null } | null>(null);
  const [readiness, setReadiness] = useState<{ twoFA: boolean; profileVerified: boolean; hasPin: boolean; percent: number }>({ twoFA: false, profileVerified: false, hasPin: false, percent: 0 });
  const [packStatus, setPackStatus] = useState<string>('Pack Ready');
  const [partnersPresence, setPartnersPresence] = useState<Array<{ category: string; name: string; status: 'Active' | 'Rotating' | 'Offline' }>>([]);
  const [activeSession, setActiveSession] = useState<{ 
    active: boolean; 
    status?: string;
    sessionSid?: string; 
    callSid?: string;
    incidentId?: string; 
    wolfId?: string;
    operator?: string; 
    startedAt?: string;
    twilioStatus?: string;
    durationSeconds?: number;
    isTerminal?: boolean;
  } | null>(null);
  const [fallbackIncidentId, setFallbackIncidentId] = useState<string | null>(null);

  // Hotline long-press behavior (mirrors /hotline)
  const LONG_PRESS_MS = 1500;
  const [isActivating, setIsActivating] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [hotlineStatus, setHotlineStatus] = useState('idle');
  const [hotlineError, setHotlineError] = useState<string | null>(null);
  const pressTimerRef = useRef<number | null>(null);
  const isPressingRef = useRef(false);
  const [isPressing, setIsPressing] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const endBannerTimerRef = useRef<number | null>(null);

  const startPress = () => {
    if (isActivating || isDeactivating) return;
    isPressingRef.current = true;
    setIsPressing(true);
    const isEnding = activeSession?.active && !isTerminal(activeSession?.twilioStatus);
    setHotlineStatus(isEnding ? 'Hold to end...' : 'Hold to activate...');
    if ('vibrate' in navigator) navigator.vibrate(10);
    pressTimerRef.current = window.setTimeout(() => {
      if (!isPressingRef.current) return;
      if (isEnding) {
        endSession(true);
      } else {
        activateHotline();
      }
    }, LONG_PRESS_MS);
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
    if (!isActivating && !isDeactivating) setHotlineStatus('idle');
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

  // Redirect in effect; while unauthenticated or loading, render nothing
  const shouldBlock = status === 'loading' || status === 'unauthenticated';

  // load identity and region
  useEffect(() => {
    let cancelled = false;
    fetch('/api/me')
      .then(async (r) => {
        if (!r.ok) return;
        const j = await r.json();
        if (!cancelled) {
          setWolfId(j.wolfId || '');
          // region is unused; skip storing for now
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Load cached incidentId to enable fallback polling when not authenticated
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      const cachedId = localStorage.getItem('lastIncidentId');
      const savedAtRaw = localStorage.getItem('lastIncidentSavedAt');
      const savedAt = savedAtRaw ? parseInt(savedAtRaw, 10) : NaN;
      const fresh = !isNaN(savedAt) && Date.now() - savedAt < 30 * 60 * 1000;
      if (cachedId && fresh) {
        setFallbackIncidentId(cachedId);
      } else if (cachedId && !fresh) {
        localStorage.removeItem('lastIncidentId');
        localStorage.removeItem('lastIncidentSavedAt');
      }
    } catch {}
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

  // active session polling (with fallback to incidentId-based polling if unauthenticated)
  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;
    const clearFallbackIfTerminal = (twilioStatus?: string | null) => {
      const s = String(twilioStatus || '').toLowerCase();
      const terminal = new Set(['completed', 'busy', 'no-answer', 'failed', 'canceled']);
      if (terminal.has(s)) {
        try {
          if (typeof window !== 'undefined') {
            localStorage.removeItem('lastIncidentId');
            localStorage.removeItem('lastIncidentSavedAt');
          }
        } catch {}
        setFallbackIncidentId(null);
      }
    };
    const load = () => {
      fetch('/api/me/active-session')
        .then(async (r) => (r.ok ? r.json() : null))
        .then((j) => {
          if (!j || cancelled) return;
          setActiveSession(j);
          if (j.active || String(j?.status || '').toLowerCase() === 'initiated') {
            if (hotlineStatus !== 'Connected to Operator') setHotlineStatus('Connected to Operator');
            if (isActivating) setIsActivating(false);
            if (j.incidentId) {
              setFallbackIncidentId(j.incidentId);
              try {
                if (typeof window !== 'undefined') {
                  localStorage.setItem('lastIncidentId', j.incidentId);
                  localStorage.setItem('lastIncidentSavedAt', String(Date.now()));
                }
              } catch {}
            }
          } else {
            const terminal = new Set(['completed', 'busy', 'no-answer', 'failed', 'canceled']);
            if (j.twilioStatus && terminal.has(j.twilioStatus)) {
              const endedMsg = `Ended: ${j.twilioStatus}${typeof j.durationSeconds === 'number' ? ` (${j.durationSeconds}s)` : ''}`;
              setHotlineStatus(endedMsg);
              if (isActivating) setIsActivating(false);
              if (endBannerTimerRef.current) {
                window.clearTimeout(endBannerTimerRef.current);
                endBannerTimerRef.current = null;
              }
              endBannerTimerRef.current = window.setTimeout(() => setHotlineStatus('idle'), 8000);
              clearFallbackIfTerminal(j.twilioStatus);
            } else if (!j.twilioStatus) {
              // Preserve Connecting state if backend is in 'initiated' phase without Twilio status yet
              if (String(j?.status || '').toLowerCase() === 'initiated') {
                if (hotlineStatus !== 'Connected to Operator') setHotlineStatus('Connected to Operator');
                if (isActivating) setIsActivating(false);
              } else {
                // Fallback: if we have a cached incidentId, poll that directly
                const id = fallbackIncidentId;
                if (id) {
                  fetch(`/api/incident/${encodeURIComponent(id)}`)
                    .then(async (r) => (r.ok ? r.json() : null))
                    .then((inc) => {
                      if (!inc || cancelled) return;
                      const s = String(inc.twilioStatus || '').toLowerCase();
                      const inProgress = s === 'queued' || s === 'initiated' || s === 'ringing' || s === 'in-progress' || s === 'answered';
                      const statusActive = String(inc.status || '').toLowerCase();
                      if (inProgress || statusActive === 'active' || statusActive === 'initiated') {
                        if (hotlineStatus !== 'Connected to Operator') setHotlineStatus('Connected to Operator');
                        setActiveSession((prev) => ({ ...(prev || {}), active: true, incidentId: inc.id }));
                      } else {
                        setHotlineStatus('idle');
                        clearFallbackIfTerminal(s);
                      }
                    })
                    .catch(() => {});
                } else {
                  setHotlineStatus('idle');
                  if (isActivating) setIsActivating(false);
                }
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
      if (endBannerTimerRef.current) window.clearTimeout(endBannerTimerRef.current);
    };
  }, [hotlineStatus, isActivating, fallbackIncidentId]);

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
  // Removed unused latency probe effect

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
  async function activateHotline() {
    setIsActivating(true);
    setHotlineError(null);
    try {
      const r = await fetch('/api/hotline/activate', { method: 'POST' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Activation failed');
      setFallbackIncidentId(j.incidentId || null);
      try { posthog.capture('hotline_activated', { wolfId: j.wolfId }); } catch {}
    } catch (e) {
      setHotlineError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setIsActivating(false);
    }
  }
  async function endSession(setBusy = false) {
    if (setBusy) setIsDeactivating(true);
    const incidentId = activeSession?.incidentId || fallbackIncidentId;
    const callSid = activeSession?.callSid;
    if (!incidentId && !callSid) {
      if (setBusy) setIsDeactivating(false);
      return;
    }
    try {
      const r = await fetch('/api/hotline/end-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ incidentId, callSid }),
      });
      if (r.ok) {
        const res = await fetch('/api/me/active-session');
        const j = await res.json().catch(() => ({ active: false }));
        setActiveSession(j);
      } else {
        const err = await r.json().catch(() => ({ error: 'Unknown error' }));
        setHotlineError(err.error || 'Failed to end session');
      }
    } catch {
      setHotlineError('Error ending session');
    } finally {
      if (setBusy) setIsDeactivating(false);
    }
  }
  const isTerminal = (status: string | undefined) => {
    const s = (status || '').toLowerCase();
    return s === 'completed' || s === 'busy' || s === 'no-answer' || s === 'failed' || s === 'canceled';
  };

  return (
    <div>
      {shouldBlock ? null : (
        <>
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
                    {(process.env.NEXT_PUBLIC_APP_ENV !== 'production' || activeSession?.active) && (
                      <Link
                        href="/status"
                        className="ml-4 inline-flex items-center gap-2 text-sm text-cta hover:opacity-90 border border-cta/30 rounded px-3 py-1"
                        aria-label="View live hotline status"
                      >
                        Status
                        <span aria-hidden>↗</span>
                      </Link>
                    )}
                  </div>
                  {activeSession?.active ? (
                    <div className="mt-4 flex justify-center">
                      <button className="w-24 h-24 rounded-full bg-green-600 text-main-text font-bold shadow-lg" disabled aria-disabled="true">
                        Connected
                      </button>
                    </div>
                  ) : (
                    <div className="mt-4 flex justify-center">
                      <HotlineButton
                        session={activeSession}
                        isPressing={isPressing}
                        isActivating={isActivating}
                        isDeactivating={isDeactivating}
                        holdProgress={holdProgress}
                        onPointerDown={startPress}
                        onPointerUp={endPress}
                        onPointerLeave={endPress}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') startPress(); }}
                        onKeyUp={endPress}
                      />
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
                        onClick={() => endSession(false)}
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
        </>
      )}
    </div>
  );
}


