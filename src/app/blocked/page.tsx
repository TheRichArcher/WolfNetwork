'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Layout from '@/components/Layout';

function BlockedContent() {
  const params = useSearchParams();
  const reason = params.get('reason');
  const [city, setCity] = useState<string | null>(null);

  useEffect(() => {
    // Geolocation stub: prefer cached/cookie city, else try navigator.geolocation
    try {
      const cached = typeof window !== 'undefined' ? localStorage.getItem('geoCity') : null;
      if (cached) {
        setCity(cached);
        return;
      }
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            // In a real app, reverse geocode. Here we set a generic placeholder.
            setCity('Current City');
          },
          () => setCity('Current City'),
          { timeout: 2000 }
        );
      } else {
        setCity('Current City');
      }
    } catch {
      setCity('Current City');
    }
  }, []);
  return (
    <div className="p-4 max-w-xl mx-auto text-center">
      <h1 className="text-2xl font-bold text-main-text">Access Restricted</h1>
      <p className="text-accent mt-2">
        {reason === 'geo'
          ? `Geofence Active${city ? `: ${city}` : ''}`
          : 'Your session does not meet access requirements.'}
      </p>
    </div>
  );
}

export default function BlockedPage() {
  return (
    <Layout>
      <Suspense fallback={<div className="p-4 text-center">Loading…</div>}>
        <BlockedContent />
      </Suspense>
    </Layout>
  );
}


