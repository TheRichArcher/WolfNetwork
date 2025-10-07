import Header from './Header';
import BottomNav from './BottomNav';

const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="relative min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 bg-background text-main-text p-2 rounded">Skip to content</a>
      <Header />
      <main id="main" role="main" className="pt-24 pb-24 md:pt-24 md:pb-24">
        {children}
      </main>
      <BottomNav />
    </div>
  );
};

export default Layout;

