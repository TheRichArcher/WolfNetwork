'use client';

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

function computeLabel(session?: Session | null, isPressing?: boolean, isActivating?: boolean): string {
  const status = (session?.twilioStatus || '').toLowerCase();
  const callSid = session?.callSid || null;
  const terminal = new Set(['completed', 'busy', 'no-answer', 'failed', 'canceled']);

  if (!callSid && !session?.active) {
    return isPressing ? 'Hold…' : 'Activate Hotline';
  }
  if (!status || status === 'queued' || status === 'initiated') {
    return 'Calling Operator…';
  }
  if (status === 'ringing' || status === 'in-progress' || status === 'answered') {
    return 'Connected to Operator';
  }
  if (terminal.has(status)) {
    const d = typeof session?.durationSeconds === 'number' ? ` (${session?.durationSeconds}s)` : '';
    return `Ended: ${status}${d}`;
  }
  // Fallback for transient UI states
  if (isActivating) return 'Dispatching…';
  return 'Activate Hotline';
}

function computeClassNames(session?: Session | null, isPressing?: boolean, isActivating?: boolean): string {
  const status = (session?.twilioStatus || '').toLowerCase();
  const callSid = session?.callSid || null;
  const terminal = new Set(['completed', 'busy', 'no-answer', 'failed', 'canceled']);
  const isActive = session?.active || status === 'ringing' || status === 'in-progress' || status === 'answered';

  const base = 'rounded-full flex items-center justify-center text-main-text font-bold shadow-lg select-none transition-all';
  const size = 'w-24 h-24 text-sm';

  if (isActive) {
    return `${base} ${size} bg-green-600`;
  }
  if (!callSid && !session?.active && isActivating) {
    return `${base} ${size} bg-gray-700`;
  }
  if (terminal.has(status)) {
    return `${base} ${size} bg-gray-700`;
  }
  const pressRing = isPressing ? ' ring-2 ring-cta scale-95' : '';
  return `${base} ${size} bg-alert animate-redPulse${pressRing}`;
}

export default function HotlineButton(props: Props) {
  const { session, isPressing, isActivating } = props;
  const label = computeLabel(session, isPressing, isActivating);
  const className = computeClassNames(session, isPressing, isActivating);
  const disabled = Boolean(session?.active) || isActivating;

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


