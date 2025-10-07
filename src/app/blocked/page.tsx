'use client';

import { useSearchParams } from 'next/navigation';
import Layout from '@/components/Layout';

export default function BlockedPage() {
  const params = useSearchParams();
  const reason = params.get('reason');

  return (
    <Layout>
      <div className="p-4 max-w-xl mx-auto text-center">
        <h1 className="text-2xl font-bold text-main-text">Access Restricted</h1>
        <p className="text-accent mt-2">
          {reason === 'geo'
            ? 'This resource is restricted to the Los Angeles geofence.'
            : 'Your session does not meet access requirements.'}
        </p>
      </div>
    </Layout>
  );
}


