'use client';

import { useEffect, useState } from 'react';
import Layout from '@/components/Layout';

export default function ProfilePage() {
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [tier, setTier] = useState(2); // 1: Silver, 2: Gold, 3: Platinum
  const [billing, setBilling] = useState<{ amount?: string; due?: string } | null>(null);

  useEffect(() => {
    const isClient = typeof window !== 'undefined';
    if (!isClient) return;
    const amount = localStorage.getItem('retainerAmount') || undefined;
    const due = localStorage.getItem('retainerDue') || undefined;
    if (amount || due) setBilling({ amount, due });
  }, []);

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
          <h2 className="text-lg font-semibold text-main-text">Tier Upgrade</h2>
          <div className="mt-3">
            <input
              type="range"
              min={1}
              max={3}
              step={1}
              value={tier}
              onChange={(e) => setTier(Number(e.target.value))}
              className="w-full"
              aria-label="Tier level"
            />
            <p className="text-accent mt-1">Current: {tierLabel}</p>
          </div>
        </section>

        <div className="flex gap-3">
          <button className="px-4 py-2 rounded border border-border text-accent" onClick={() => alert('Exporting NRS (mock).')}>Export NRS PDF</button>
        </div>
      </div>
    </Layout>
  );
}


