import Link from 'next/link';
import RelayStatus from '@/components/RelayStatus';

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

