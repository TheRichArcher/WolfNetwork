'use client';

import React from 'react';

declare global {
  interface Window {
    __wolfLog?: (e: unknown) => void;
  }
}

type Session = {
  active?: boolean;
  callSid?: string;
  twilioStatus?: string;
  durationSeconds?: number;
};

type Props = {
  session?: Session | null;
  isPressing: boolean;
  isActivating: boolean;
  isDeactivating?: boolean;
  holdProgress?: number; // 0..1 during hold
  onPointerDown: () => void;
  onPointerUp: () => void;
  onPointerLeave: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>) => void;
  onKeyUp: () => void;
};

function isTerminal(status: string | undefined): boolean {
  const s = (status || '').toLowerCase();
  return s === 'completed' || s === 'busy' || s === 'no-answer' || s === 'failed' || s === 'canceled';
}

function isInProgress(status: string | undefined): boolean {
  const s = (status || '').toLowerCase();
  return s === 'queued' || s === 'initiated' || s === 'ringing' || s === 'in-progress' || s === 'answered';
}

function computeLabel(session?: Session | null, isPressing?: boolean, isActivating?: boolean, isDeactivating?: boolean, terminalResetAt?: number | null): string {
  const status = (session?.twilioStatus || '').toLowerCase();
  const callSid = session?.callSid || null;
  if (terminalResetAt && Date.now() >= terminalResetAt) {
    return 'Idle\nHold to Activate';
  }
  if (isDeactivating) return 'Ending…';
  if (session?.active && isPressing && !isTerminal(status)) {
    return 'Hold to End…';
  }
  if (!callSid && !session?.active && !isInProgress(status)) {
    return isPressing ? 'Hold…' : 'Idle\nHold to Activate';
  }
  // If we have no status but there is a callSid, assume dialing and show Calling
  if ((!status && callSid) || status === 'queued' || status === 'initiated') {
    return 'Calling Operator…';
  }
  if (status === 'ringing' || status === 'in-progress' || status === 'answered') {
    return isPressing ? 'Hold to End…' : 'Connected\nHold to End';
  }
  if (isTerminal(status)) {
    const d = typeof session?.durationSeconds === 'number' ? ` (${session?.durationSeconds}s)` : '';
    return `Ended: ${status}${d}`;
  }
  // Fallback for transient UI states
  if (isActivating) return 'Dispatching…';
  return 'Idle\nHold to Activate';
}

function computeClassNames(session?: Session | null, isPressing?: boolean, isActivating?: boolean, isDeactivating?: boolean, terminalResetAt?: number | null): string {
  const status = (session?.twilioStatus || '').toLowerCase();
  const callSid = session?.callSid || null;
  const terminal = isTerminal(status);
  const isActive = status === 'ringing' || status === 'in-progress' || status === 'answered' || Boolean(session?.active);
  const base = 'rounded-full flex items-center justify-center text-main-text font-bold shadow-lg select-none transition-all whitespace-pre-wrap text-center';
  const size = 'w-24 h-24 text-sm';
  if (isDeactivating) {
    return `${base} ${size} bg-gray-700`;
  }
  if (isActive && !terminal) {
    return `${base} ${size} bg-green-600`;
  }
  if (!callSid && !session?.active && isActivating) {
    return `${base} ${size} bg-gray-700`;
  }
  if (terminal && (!terminalResetAt || Date.now() < terminalResetAt)) {
    return `${base} ${size} bg-gray-700`;
  }
  const pressRing = isPressing ? ' ring-2 ring-cta scale-95' : '';
  return `${base} ${size} bg-alert animate-redPulse${pressRing}`;
}

export default function HotlineButton(props: Props) {
  const { session, isPressing, isActivating } = props;
  const [terminalResetAt, setTerminalResetAt] = React.useState<number | null>(null);

  // When we see a terminal status, show it for 8s then reset label to Activate regardless of API state
  React.useEffect(() => {
    const status = (session?.twilioStatus || '').toLowerCase();
    if (isTerminal(status)) {
      if (!terminalResetAt) {
        const t = Date.now() + 8000;
        setTerminalResetAt(t);
        const timer = window.setTimeout(() => setTerminalResetAt(null), 8000);
        try { window.__wolfLog?.({ event: 'hotline_button_reset_triggered', status, duration: session?.durationSeconds }); } catch {}
        return () => window.clearTimeout(timer);
      }
    } else if (status && !isInProgress(status)) {
      // Clear if status went back to non-terminal/idle
      if (terminalResetAt) setTerminalResetAt(null);
    }
    return;
  }, [session?.twilioStatus, session?.durationSeconds, terminalResetAt]);

  const label = computeLabel(session, isPressing, isActivating, props.isDeactivating, terminalResetAt);
  const className = computeClassNames(session, isPressing, isActivating, props.isDeactivating, terminalResetAt);
  const disabled = isActivating || Boolean(props.isDeactivating);
  const progress = Math.max(0, Math.min(1, typeof props.holdProgress === 'number' ? props.holdProgress : 0));
  const showProgress = isPressing && !isActivating && !Boolean(props.isDeactivating);

  return (
    <button
      style={{ position: 'relative' as const }}
      onPointerDown={props.onPointerDown}
      onPointerUp={props.onPointerUp}
      onPointerLeave={props.onPointerLeave}
      onKeyDown={props.onKeyDown}
      onKeyUp={props.onKeyUp}
      aria-pressed={isPressing || isActivating || Boolean(session?.active)}
      aria-label="Activate hotline"
      disabled={disabled}
      aria-disabled={disabled}
      className={className}
    >
      {showProgress ? (
        <svg
          aria-hidden
          viewBox="0 0 100 100"
          width="100%"
          height="100%"
          style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}
        >
          <circle cx="50" cy="50" r="45" stroke="rgba(255,255,255,0.18)" strokeWidth="6" fill="none" />
          <circle
            cx="50"
            cy="50"
            r="45"
            stroke="#f97316"
            strokeWidth="6"
            strokeLinecap="round"
            fill="none"
            strokeDasharray={Math.PI * 2 * 45}
            strokeDashoffset={(1 - progress) * Math.PI * 2 * 45}
          />
        </svg>
      ) : null}
      {label}
    </button>
  );
}


