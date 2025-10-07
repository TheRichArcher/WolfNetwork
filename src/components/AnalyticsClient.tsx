'use client';

import { useEffect } from 'react';
import posthog from 'posthog-js';

export default function AnalyticsClient() {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
    if (!key || !host) return;
    posthog.init(key, {
      api_host: host,
      capture_pageview: true,
      loaded: () => {
        posthog.capture('$pageview');
      },
    });
  }, []);

  return null;
}


