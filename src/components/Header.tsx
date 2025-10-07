import Image from 'next/image';

const Header = () => {
  const hasAlert = true; // Mock alert state

  return (
    <header role="banner" aria-label="Site header" className="fixed top-0 left-0 right-0 bg-background z-10 flex items-center justify-between p-4 h-20 border-b border-border">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-bold text-main-text">The Wolf Network</h1>
        {hasAlert && (
          <div className="relative">
            <span className="absolute top-0 right-0 h-3 w-3 rounded-full bg-alert animate-redPulse"></span>
          </div>
        )}
      </div>
      <Image
        src="/wolf-logo.png"
        alt="Wolf Network logo"
        width={32}
        height={32}
        className="rounded"
        priority
      />
    </header>
  );
};

export default Header;
