'use client';

import React, { useState, useRef } from 'react';

export type CrisisType = 'legal' | 'medical' | 'security' | 'pr';

type CrisisSelectorProps = {
  onActivate: (crisisType: CrisisType) => void;
  isActivating: boolean;
  isConnected: boolean;
  disabled?: boolean;
};

const CATEGORIES: { type: CrisisType; icon: string; label: string }[] = [
  { type: 'legal', icon: '⚖️', label: 'Legal' },
  { type: 'medical', icon: '🏥', label: 'Medical' },
  { type: 'security', icon: '🛡️', label: 'Security' },
  { type: 'pr', icon: '📢', label: 'PR' },
];

const LONG_PRESS_MS = 1500;

export default function CrisisSelector({ onActivate, isActivating, isConnected, disabled }: CrisisSelectorProps) {
  const [selected, setSelected] = useState<CrisisType | null>(null);
  const [isPressing, setIsPressing] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  
  const pressTimerRef = useRef<number | null>(null);
  const isPressingRef = useRef(false);

  const startPress = () => {
    if (!selected || isActivating || isConnected || disabled) return;
    
    isPressingRef.current = true;
    setIsPressing(true);
    if ('vibrate' in navigator) navigator.vibrate(10);
    
    pressTimerRef.current = window.setTimeout(() => {
      if (!isPressingRef.current || !selected) return;
      onActivate(selected);
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
  };

  // Connected state - show green button
  if (isConnected) {
    return (
      <div className="flex flex-col items-center gap-6">
        <button
          className="w-32 h-32 rounded-full bg-green-600 text-white font-bold text-lg shadow-xl flex items-center justify-center"
          disabled
        >
          Connected
        </button>
        <p className="text-accent text-sm">Your operator is on the line</p>
      </div>
    );
  }

  // Activating state - show pulsing button
  if (isActivating) {
    return (
      <div className="flex flex-col items-center gap-6">
        <button
          className="w-32 h-32 rounded-full bg-amber-600 text-white font-bold text-lg shadow-xl flex items-center justify-center animate-pulse"
          disabled
        >
          Connecting...
        </button>
        <p className="text-accent text-sm">Finding your {selected} specialist</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Category Selection */}
      <div className="grid grid-cols-4 gap-3 w-full max-w-sm">
        {CATEGORIES.map(({ type, icon, label }) => (
          <button
            key={type}
            onClick={() => setSelected(type)}
            disabled={disabled}
            className={`
              flex flex-col items-center justify-center p-3 rounded-xl transition-all
              ${selected === type 
                ? 'bg-cta/20 border-2 border-cta scale-105' 
                : 'bg-surface-2 border border-border hover:border-cta/50'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            <span className="text-2xl">{icon}</span>
            <span className="text-xs mt-1 text-main-text">{label}</span>
          </button>
        ))}
      </div>

      {/* The Big Button */}
      <div className="relative">
        <button
          onPointerDown={startPress}
          onPointerUp={endPress}
          onPointerLeave={endPress}
          onTouchStart={startPress}
          onTouchEnd={endPress}
          disabled={!selected || disabled}
          className={`
            w-32 h-32 rounded-full font-bold text-lg shadow-xl 
            flex items-center justify-center transition-all select-none
            ${!selected 
              ? 'bg-gray-700 text-gray-400 cursor-not-allowed' 
              : isPressing
                ? 'bg-red-700 scale-95 ring-4 ring-cta'
                : 'bg-alert text-white animate-redPulse cursor-pointer'
            }
          `}
          style={{ position: 'relative' }}
        >
          {/* Progress ring */}
          {isPressing && (
            <svg
              aria-hidden
              viewBox="0 0 100 100"
              className="absolute inset-0 w-full h-full"
              style={{ transform: 'rotate(-90deg)' }}
            >
              <circle 
                cx="50" cy="50" r="45" 
                stroke="rgba(255,255,255,0.2)" 
                strokeWidth="6" 
                fill="none" 
              />
              <circle
                cx="50" cy="50" r="45"
                stroke="#f97316"
                strokeWidth="6"
                strokeLinecap="round"
                fill="none"
                strokeDasharray={Math.PI * 2 * 45}
                strokeDashoffset={(1 - holdProgress) * Math.PI * 2 * 45}
              />
            </svg>
          )}
          
          <span className="relative z-10 text-center leading-tight">
            {!selected ? 'Select\nCrisis Type' : isPressing ? 'Hold...' : 'HOLD'}
          </span>
        </button>
      </div>

      {/* Instructions */}
      <p className="text-accent text-sm text-center max-w-xs">
        {!selected 
          ? 'Select what you need help with' 
          : `Press and hold to connect with ${selected} support`
        }
      </p>
    </div>
  );
}
