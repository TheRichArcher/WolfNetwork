'use client';

import Layout from '@/components/Layout';
import WolfIcon from '@/components/WolfIcon';

const PartnerCard = ({ name, badges }: { name: string; badges: string[] }) => {
  return (
    <div className="bg-surface rounded-lg p-4 border border-border flex flex-col">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-surface-2 flex items-center justify-center text-accent border border-border">
          <WolfIcon className="w-6 h-6" />
        </div>
        <div>
          <p className="text-main-text font-semibold">{name}</p>
          <div className="flex flex-wrap gap-2 mt-1">
            {badges.map((b) => (
              <span key={b} className="text-xs px-2 py-0.5 rounded bg-surface-2 text-accent border border-border">
                {b}
              </span>
            ))}
          </div>
        </div>
      </div>
      <button
        className="mt-4 px-4 py-2 rounded bg-cta text-background font-semibold hover:opacity-90"
        aria-label="Howl to request availability"
        onClick={() => alert('Howl sent (mock).')}
      >
        Howl
      </button>
    </div>
  );
};

export default function PartnersPage() {
  const partners = [
    { name: 'LA Legal Wolf #47', badges: ['95% NRS', 'Cyber Specialist'] },
    { name: 'LA Medical Wolf #12', badges: ['Rapid Response', 'Discreet Care'] },
    { name: 'LA PR Wolf #05', badges: ['Crisis PR', 'Leak Containment'] },
  ];

  return (
    <Layout>
      <div className="p-4">
        <h1 className="text-2xl font-bold text-main-text">Partner Marketplace</h1>
        <p className="text-accent mt-2">Anonymous profiles. Your Pack Rating influences matches.</p>

        <div className="mt-4 flex gap-2">
          <input
            className="flex-1 bg-surface border border-border rounded px-3 py-2 text-main-text placeholder-gray-500"
            placeholder="Filter by domain or speed (e.g., PR, Cyber, Rapid)"
            aria-label="Filter partners"
          />
          <button className="px-3 py-2 rounded border border-border text-accent">Filter</button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
          {partners.map((p) => (
            <PartnerCard key={p.name} name={p.name} badges={p.badges} />
          ))}
        </div>
      </div>
    </Layout>
  );
}


