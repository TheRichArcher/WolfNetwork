import Link from 'next/link';

const BottomNav = () => {
  return (
    <footer role="contentinfo" aria-label="Bottom navigation" className="fixed bottom-0 left-0 right-0 bg-background z-10">
      <div className="px-4 py-1 text-center text-xs text-gray-300 border-t border-border">
        We delete more data in a day than most companies protect in a year
      </div>
      <RelayStatus />
      <nav aria-label="Primary" className="flex justify-around items-center h-14 px-4 border-t border-border">
        <Link href="/" className="text-accent hover:text-main-text focus:outline-none focus:ring-2 focus:ring-cta rounded">Home</Link>
        <Link href="/hotline" className="text-accent hover:text-main-text focus:outline-none focus:ring-2 focus:ring-cta rounded">Hotline</Link>
        <Link href="/profile" className="text-accent hover:text-main-text focus:outline-none focus:ring-2 focus:ring-cta rounded">Profile</Link>
        <Link href="/partners" className="text-accent hover:text-main-text focus:outline-none focus:ring-2 focus:ring-cta rounded">Partners</Link>
      </nav>
    </footer>
  );
};

export default BottomNav;

function RelayStatus() {
  // Light client-only status: region from /api/me and latency via a quick ping
  if (typeof window === 'undefined') return null as unknown as JSX.Element;
  // Lazy component to avoid SSR issues
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const React = require('react') as any;
  const { useEffect, useState } = React;
  const [region, setRegion] = useState<string>('');
  const [latency, setLatency] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    const started = performance.now();
    fetch('/api/me')
      .then(async (r: Response) => {
        if (!r.ok) return;
        const j = await r.json();
        if (!cancelled) setRegion(j.region || '');
      })
      .catch(() => {});
    fetch('/api/me')
      .then(() => {
        if (cancelled) return;
        setLatency(Math.round(performance.now() - started));
      })
      .catch(() => setLatency(null));
    return () => {
      cancelled = true;
    };
  }, []);
  return (
    <div className="px-4 py-1 text-center text-[10px] text-gray-400 border-t border-border">
      Secure Relay Active: {region || '—'} Node — {latency != null ? `${latency}ms` : '…'}
    </div>
  );
}

