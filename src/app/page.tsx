'use client';

import { useState } from 'react';
import SplashScreen from '@/components/SplashScreen';
import Layout from '@/components/Layout';
import CardCarousel from '@/components/CardCarousel';

export default function Home() {
  const [loading, setLoading] = useState(true);

  return (
    <div>
      {loading ? (
        <SplashScreen onFinished={() => setLoading(false)} />
      ) : (
        <Layout>
          <div className="p-4">
            <h2 className="text-2xl font-bold">At-a-Glance</h2>
            <div className="h-0.5 w-12 bg-cta mb-4" aria-hidden="true" />
            <CardCarousel />
            <div className="mt-8">
              <h2 className="text-2xl font-bold mb-4">Personalized Tips</h2>
              <p className="text-cta motion-safe:animate-pulse" aria-describedby="tip-detail">Proactive: Scan for Cyber Threats.</p>
              <span id="tip-detail" className="sr-only">Subtle pulse indicates actionable tip</span>
            </div>
          </div>
        </Layout>
      )}
    </div>
  );
}
