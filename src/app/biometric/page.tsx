'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Layout from '@/components/Layout';

export default function BiometricPage() {
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
      // Placeholder: In future, integrate real WebAuthn. For now, set a short-lived cookie.
      const maxAge = 60 * 60; // 1 hour
      document.cookie = `biometric_ok=1; Max-Age=${maxAge}; Path=/; SameSite=Lax`;
      router.replace(next);
    } catch (e) {
      setError('Biometric confirmation failed.');
    }
  }, [next, router]);

  return (
    <Layout>
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
    </Layout>
  );
}


