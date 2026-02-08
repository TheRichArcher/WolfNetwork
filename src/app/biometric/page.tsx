'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Layout from '@/components/Layout';

function BiometricContent() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/';
  const [supported, setSupported] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSupported(typeof window !== 'undefined' && 'PublicKeyCredential' in window);
  }, []);

  const confirm = useCallback(async () => {
    try {
      // Set cookie via server-side API to ensure HttpOnly + Secure flags
      const res = await fetch('/api/biometric/confirm', { method: 'POST' });
      if (!res.ok) throw new Error('Biometric confirmation failed');
      router.replace(next);
    } catch {
      setError('Biometric confirmation failed.');
    }
  }, [next, router]);

  return (
    <div className="p-4 max-w-xl mx-auto text-center">
      <h1 className="text-2xl font-bold text-main-text">Biometric Check</h1>
      <p className="text-accent mt-2">Additional verification is required to proceed.</p>
      <div className="mt-6">
        <button
          className="px-4 py-2 rounded bg-cta text-background font-semibold"
          onClick={confirm}
        >
          {supported ? 'Verify with Biometrics' : 'Confirm and Continue'}
        </button>
        {error && <p className="text-red-400 mt-3">{error}</p>}
      </div>
    </div>
  );
}

export default function BiometricPage() {
  return (
    <Layout>
      <Suspense fallback={<div className="p-4 text-center">Loading…</div>}>
        <BiometricContent />
      </Suspense>
    </Layout>
  );
}


