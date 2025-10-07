'use client';

import { useState } from 'react';
import Layout from '@/components/Layout';

export default function DebriefPage() {
  const [rating, setRating] = useState<'up' | 'down' | null>(null);
  const [notes, setNotes] = useState('');

  return (
    <Layout>
      <div className="p-4">
        <div className="bg-surface rounded-lg p-6 border border-border text-center animate-fadeIn">
          <div className="text-main-text text-5xl">✓</div>
          <h1 className="text-2xl font-bold text-main-text mt-2">Case Closed</h1>
          <p className="text-accent mt-1">Timestamp: {new Date().toLocaleString()}</p>

          <div className="mt-6">
            <p className="text-main-text mb-2">NRS feedback</p>
            <div className="flex justify-center gap-4">
              <button
                className={`px-4 py-2 rounded border ${rating === 'up' ? 'border-border text-main-text' : 'border-border text-accent'}`}
                onClick={() => setRating('up')}
                aria-label="Thumbs up"
              >
                👍
              </button>
              <button
                className={`px-4 py-2 rounded border ${rating === 'down' ? 'border-red-500 text-red-400' : 'border-border text-accent'}`}
                onClick={() => setRating('down')}
                aria-label="Thumbs down"
              >
                👎
              </button>
            </div>
            <div className="mt-4">
              <label className="block text-left text-gray-400 mb-1">What brought relief?</label>
              <textarea
                className="w-full bg-surface-2 border border-border rounded p-3 text-main-text"
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Share details (encrypted, mock)"
              />
            </div>
            <button
              className="mt-4 px-4 py-2 rounded bg-cta text-background font-semibold"
              onClick={() => alert(`Feedback saved (mock). Rating: ${rating ?? 'none'}`)}
            >
              Save Feedback
            </button>
          </div>

          <div className="mt-8">
            <button className="px-4 py-2 rounded border border-gray-700 text-accent" onClick={() => alert('Invite sent (mock).')}>
              Invite a Pack Mate
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}


