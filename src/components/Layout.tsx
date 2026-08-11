import { useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Compass, GraduationCap, Home, Receipt, UserRound } from 'lucide-react';
import { useMarketStore } from '../stores/marketStore';
import { usePortfolioStore } from '../stores/portfolioStore';
import { useUserStore } from '../stores/userStore';
import { Toasts } from './Toasts';

// ---------------------------------------------------------------------------
// App shell: responsive navigation (bottom tab bar on mobile — the primary
// GenZ form factor — sidebar on desktop) plus app-level lifecycle:
//  • start the live market ticker
//  • record the daily visit (streaks)
//  • process scheduled events that came due while away (dividends,
//    recurring buys, round-ups)
//  • sync the dark/light theme class
// ---------------------------------------------------------------------------

const TABS = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/discover', label: 'Discover', icon: Compass },
  { to: '/learn', label: 'Learn', icon: GraduationCap },
  { to: '/activity', label: 'Activity', icon: Receipt },
  { to: '/profile', label: 'Profile', icon: UserRound },
];

export function Layout() {
  const startTicker = useMarketStore((s) => s.startTicker);
  const theme = useUserStore((s) => s.theme);

  useEffect(() => {
    startTicker();
    useUserStore.getState().recordVisit();
    usePortfolioStore.getState().processScheduledEvents();
  }, [startTicker]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-[11px] font-medium transition-colors sm:flex-row sm:gap-3 sm:px-4 sm:py-2.5 sm:text-sm ${
      isActive ? 'text-brand-400 sm:bg-brand-500/10' : 'text-ink-400 hover:text-ink-200'
    }`;

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col gap-1 border-r border-ink-800 p-4 sm:flex">
        <div className="mb-6 flex items-center gap-2 px-2 pt-2">
          <img src="/favicon.svg" alt="" className="h-8 w-8" />
          <span className="font-display text-xl font-bold tracking-tight">stackd</span>
        </div>
        {TABS.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'} className={linkClass}>
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
        <p className="mt-auto px-2 text-[11px] leading-relaxed text-ink-600">
          Simulated prices. Practice money. Real learning. 🎓
        </p>
      </aside>

      {/* Page content */}
      <main className="min-w-0 flex-1 px-4 pb-24 pt-5 sm:px-8 sm:pb-10">
        <Outlet />
      </main>

      {/* Mobile bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t border-ink-800 bg-ink-950/90 px-2 py-2 backdrop-blur sm:hidden">
        {TABS.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'} className={linkClass}>
            <Icon size={20} />
            {label}
          </NavLink>
        ))}
      </nav>

      <Toasts />
    </div>
  );
}
