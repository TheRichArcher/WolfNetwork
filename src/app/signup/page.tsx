'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import Layout from '@/components/Layout';

export default function SignupPage() {
  const [mode, setMode] = useState<'invite' | 'comped'>('invite');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submitInvite(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const r = await fetch('/api/signup/request-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email || undefined, phone: phone || undefined }),
      });
      if (r.ok) {
        setMessage("Thanks! You'll be notified when we're ready to onboard new members.");
        setEmail('');
        setPhone('');
      } else {
        const j = await r.json().catch(() => ({}));
        setError(j.error || 'Something went wrong');
      }
    } finally {
      setLoading(false);
    }
  }

  async function submitComped(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const r = await fetch('/api/signup/comped-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });
      const j = (await r.json().catch(() => ({}))) as { valid?: boolean; next?: string; error?: string };
      if (r.ok && j.valid) {
        setMessage('Code accepted. Redirecting to sign in...');
        try { if (typeof window !== 'undefined') localStorage.setItem('inviteValidated', '1'); } catch {}
        // Prefer NextAuth signIn to forward login_hint/screen_hint to Auth0
        await signIn('auth0', {
          callbackUrl: '/',
          login_hint: email,
          screen_hint: 'signup',
        } as any);
      } else {
        setError(j.error || 'Invalid code');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout>
      <div className="p-5 max-w-xl mx-auto">
        <h1 className="text-2xl font-bold">Join The Wolf Network</h1>
        <div className="mt-4 flex gap-3">
          <button
            className={`px-3 py-2 rounded ${mode === 'invite' ? 'bg-cta text-background' : 'bg-surface text-main-text border border-border'}`}
            onClick={() => setMode('invite')}
          >
            Request Access
          </button>
          <button
            className={`px-3 py-2 rounded ${mode === 'comped' ? 'bg-cta text-background' : 'bg-surface text-main-text border border-border'}`}
            onClick={() => setMode('comped')}
          >
            Have a code?
          </button>
        </div>

        {mode === 'invite' ? (
          <form onSubmit={submitInvite} className="mt-6 space-y-4 bg-surface rounded-lg p-5 border border-border">
            <div>
              <label className="block text-sm text-accent">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded bg-background border border-border px-3 py-2"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-sm text-accent">Phone (optional)</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1 w-full rounded bg-background border border-border px-3 py-2"
                placeholder="+15551234567"
              />
            </div>
            <button disabled={loading} className="px-4 py-2 rounded bg-cta text-background font-semibold disabled:opacity-60">
              {loading ? 'Submitting...' : 'Request Access'}
            </button>
          </form>
        ) : (
          <form onSubmit={submitComped} className="mt-6 space-y-4 bg-surface rounded-lg p-5 border border-border">
            <div>
              <label className="block text-sm text-accent">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded bg-background border border-border px-3 py-2"
                placeholder="you@example.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-accent">Comped Code</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="mt-1 w-full rounded bg-background border border-border px-3 py-2"
                placeholder="Enter your code"
                required
              />
            </div>
            <button disabled={loading} className="px-4 py-2 rounded bg-cta text-background font-semibold disabled:opacity-60">
              {loading ? 'Validating...' : 'Continue'}
            </button>
          </form>
        )}

        {message ? <p className="mt-4 text-green-400">{message}</p> : null}
        {error ? <p className="mt-4 text-red-400">{error}</p> : null}
      </div>
    </Layout>
  );
}


