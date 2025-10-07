const Card = ({ title, children }: { title: string; children: React.ReactNode }) => {
  return (
    <section aria-label={title} className="group relative flex-shrink-0 w-80 md:w-full bg-surface rounded-lg p-6 mr-4 md:mr-0 transition-transform motion-safe:duration-200 motion-safe:ease-out motion-safe:hover:scale-[1.01] border border-border">
      <h3 className="text-lg font-bold text-accent">{title}</h3>
      <div className="mt-4 text-main-text">
        {children}
      </div>
    </section>
  );
};

const CardCarousel = () => {
  const isClient = typeof window !== 'undefined';
  const statusText = (isClient && localStorage.getItem('packStatus')) || 'Pack Ready';
  const auditsSummary = (isClient && localStorage.getItem('recentAuditLabel')) || 'Cyber Threat Scan — ';
  const auditsResult = (isClient && localStorage.getItem('recentAuditResult')) || 'Passed';
  const nextRetainerAmount = (isClient && localStorage.getItem('retainerAmount')) || null;
  const nextRetainerDue = (isClient && localStorage.getItem('retainerDue')) || null;
  const hasRetainer = Boolean(nextRetainerAmount || nextRetainerDue);

  return (
    <div role="region" aria-label="At-a-Glance cards" className="flex overflow-x-auto py-4 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-4 md:overflow-visible">
      <Card title="Status">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-2xl font-bold text-cta" aria-live="polite">{statusText}</p>
            <p className="text-sm text-gray-300" aria-label="Status: All partners online">All partners are online.</p>
          </div>
          <div className="relative">
            <button aria-describedby="tooltip-status" aria-label="Relief: Pack Ready means less than five minute dispatch" className="text-cta focus:outline-none focus:ring-2 focus:ring-cta rounded px-1">
              i
            </button>
            <div id="tooltip-status" role="tooltip" className="pointer-events-none absolute right-0 mt-2 w-56 rounded bg-surface-2 text-gray-100 text-xs p-2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 shadow-lg border border-border transition-opacity">
              Relief: Pack Ready means &lt;5-min dispatch.
            </div>
          </div>
        </div>
      </Card>
      <Card title="Recent Audits">
        <p>{auditsSummary}<span className="text-main-text">{auditsResult}</span></p>
        <p className="text-sm text-gray-300">Completed 2 days ago.</p>
      </Card>
      {hasRetainer && (
        <Card title="Next Retainer">
          <p className="text-2xl font-bold">{nextRetainerAmount || '—'}</p>
          {nextRetainerDue && <p className="text-sm text-gray-300">{nextRetainerDue}</p>}
        </Card>
      )}
    </div>
  );
};

export default CardCarousel;

