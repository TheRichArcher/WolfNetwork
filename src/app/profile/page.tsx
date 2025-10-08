'use client';

import { useEffect, useState } from 'react';
import posthog from 'posthog-js';
import Layout from '@/components/Layout';

export default function ProfilePage() {
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [tier, setTier] = useState(2); // 1: Silver, 2: Gold, 3: Platinum
  const [billing, setBilling] = useState<{ amount?: string; due?: string } | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const isClient = typeof window !== 'undefined';
    if (!isClient) return;
    const amount = localStorage.getItem('retainerAmount') || undefined;
    const due = localStorage.getItem('retainerDue') || undefined;
    if (amount || due) setBilling({ amount, due });
  }, []);

  useEffect(() => {
    // Handle return from Stripe
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const status = params.get('checkout');
    const retTier = params.get('tier');
    if (status === 'success' && retTier) {
      setChecking(true);
      fetch('/api/billing/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier: retTier }) })
        .then(() => {
          try { posthog.capture('checkout_success', { tier: retTier }); } catch {}
          localStorage.setItem('userTier', retTier);
        })
        .finally(() => setChecking(false));
    }
  }, []);

  async function startCheckout() {
    const selected = tier === 3 ? 'Platinum' : tier === 2 ? 'Gold' : 'Silver';
    try { posthog.capture('checkout_start', { tier: selected }); } catch {}
    const resp = await fetch('/api/billing/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier: selected }) });
    const data = await resp.json();
    if (data?.url) window.location.href = data.url as string;
    else alert(data?.error || 'Unable to start checkout');
  }

  const tierLabel = tier === 3 ? 'Platinum' : tier === 2 ? 'Gold' : 'Silver';

  return (
    <Layout>
      <div className="p-4 space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-main-text">Profile & Audits</h1>
          <span className="px-3 py-1 rounded border border-border text-accent">{tierLabel} Tier</span>
        </header>

        {billing && (
          <section className="bg-surface rounded-lg p-4 border border-border">
            <h2 className="text-lg font-semibold text-main-text">Billing</h2>
            <p className="text-accent mt-1">Monthly recurring retainer</p>
            <div className="mt-2 flex items-center gap-4">
              {billing.amount && (
                <p className="text-main-text text-xl font-bold">{billing.amount}</p>
              )}
              {billing.due && (
                <span className="text-gray-400">{billing.due}</span>
              )}
            </div>
          </section>
        )}

        <section className="bg-surface rounded-lg p-4 border border-border">
          <h2 className="text-lg font-semibold text-main-text">Audit Scheduler</h2>
          <div className="mt-3 flex flex-wrap gap-3 items-center">
            <input type="date" className="bg-surface-2 border border-border rounded px-3 py-2 text-main-text" />
            <input type="time" className="bg-surface-2 border border-border rounded px-3 py-2 text-main-text" />
            <button className="px-4 py-2 rounded bg-cta text-background font-semibold" onClick={() => alert('Audit scheduled (mock).')}>Schedule</button>
          </div>
        </section>

        <section className="bg-surface rounded-lg p-4 border border-border">
          <h2 className="text-lg font-semibold text-main-text">Data Vault</h2>
          <p className="text-gray-400 mt-1">We delete more data in a day than most companies protect in a year.</p>
          <div className="mt-3 flex items-center gap-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={deleteArmed}
                onChange={(e) => setDeleteArmed(e.target.checked)}
              />
              <span className="text-main-text">Arm &quot;Delete Logs Now&quot;</span>
            </label>
            <button
              className="px-4 py-2 rounded border border-red-500 text-red-400 disabled:opacity-50"
              disabled={!deleteArmed}
              onClick={() => {
                setDeleteArmed(false);
                alert('Logs deleted (mock).');
              }}
            >
              Delete Logs Now
            </button>
          </div>
        </section>

        <section className="bg-surface rounded-lg p-4 border border-border">
          <h2 className="text-lg font-semibold text-main-text">Choose Your Tier</h2>
          <div className="mt-3 flex flex-wrap gap-3" role="radiogroup" aria-label="Tier">
            <button
              type="button"
              role="radio"
              aria-checked={tier === 1}
              className={`px-4 py-2 rounded border ${tier === 1 ? 'border-cta text-cta' : 'border-border text-main-text'}`}
              onClick={() => setTier(1)}
            >
              Silver
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={tier === 2}
              className={`px-4 py-2 rounded border ${tier === 2 ? 'border-cta text-cta' : 'border-border text-main-text'}`}
              onClick={() => setTier(2)}
            >
              Gold
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={tier === 3}
              className={`px-4 py-2 rounded border ${tier === 3 ? 'border-cta text-cta' : 'border-border text-main-text'}`}
              onClick={() => setTier(3)}
            >
              Platinum
            </button>
          </div>
          <p className="text-accent mt-2">Selected: {tierLabel}</p>
          <button className="mt-3 px-4 py-2 rounded bg-cta text-background font-semibold disabled:opacity-50" onClick={startCheckout} disabled={checking}>
            {checking ? 'Verifying…' : 'Upgrade & Checkout'}
          </button>
        </section>

        <div className="flex gap-3">
          <button className="px-4 py-2 rounded border border-border text-accent" onClick={() => alert('Exporting NRS (mock).')}>Export NRS PDF</button>
        </div>
      </div>
    </Layout>
  );
}


