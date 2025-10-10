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

function computeLabel(session?: Session | null, isPressing?: boolean, isActivating?: boolean, terminalResetAt?: number | null): string {
  const status = (session?.twilioStatus || '').toLowerCase();
  const callSid = session?.callSid || null;

  if (terminalResetAt && Date.now() >= terminalResetAt) {
    return 'Activate Hotline';
  }

  if (!callSid && !session?.active && !isInProgress(status)) {
    return isPressing ? 'Hold…' : 'Activate Hotline';
  }
  if (!status || status === 'queued' || status === 'initiated') {
    return 'Calling Operator…';
  }
  if (status === 'ringing' || status === 'in-progress' || status === 'answered') {
    return 'Connected to Operator';
  }
  if (isTerminal(status)) {
    const d = typeof session?.durationSeconds === 'number' ? ` (${session?.durationSeconds}s)` : '';
    return `Ended: ${status}${d}`;
  }
  // Fallback for transient UI states
  if (isActivating) return 'Dispatching…';
  return 'Activate Hotline';
}

function computeClassNames(session?: Session | null, isPressing?: boolean, isActivating?: boolean, terminalResetAt?: number | null): string {
  const status = (session?.twilioStatus || '').toLowerCase();
  const callSid = session?.callSid || null;
  const terminal = isTerminal(status);
  const isActive = status === 'ringing' || status === 'in-progress' || status === 'answered' || Boolean(session?.active);

  const base = 'rounded-full flex items-center justify-center text-main-text font-bold shadow-lg select-none transition-all';
  const size = 'w-24 h-24 text-sm';

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

  const label = computeLabel(session, isPressing, isActivating, terminalResetAt);
  const className = computeClassNames(session, isPressing, isActivating, terminalResetAt);
  const disabled = isInProgress(session?.twilioStatus) || isActivating;

  return (
    <button
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
      {label}
    </button>
  );
}


