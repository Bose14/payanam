import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { ShellContext } from './ShellContext';

const ICONS: Record<string, JSX.Element> = {
  ride: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="6" cy="16" r="3.5" /><circle cx="18" cy="16" r="3.5" /><path d="M6 16l4-7h5l3 7M10 9l2-3h2" />
    </svg>
  ),
  plan: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M5 6h14M5 12h14M5 18h9" />
    </svg>
  ),
  discover: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="8.5" /><path d="M15.5 8.5l-2 5-5 2 2-5z" />
    </svg>
  ),
  chat: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <path d="M4 5h16v11H9l-5 4z" />
    </svg>
  ),
  me: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 5-6 8-6s6.5 2 8 6" />
    </svg>
  ),
};

interface TabDef {
  key: string;
  label: string;
  to: string;
  /** Extra path prefixes that keep this tab highlighted. */
  also: string[];
}

const TABS: TabDef[] = [
  { key: 'ride', label: 'Ride', to: '/ride', also: [] },
  { key: 'plan', label: 'Plan', to: '/plan', also: ['/dashboard', '/trips', '/join'] },
  { key: 'discover', label: 'Discover', to: '/discover', also: [] },
  { key: 'chat', label: 'Chat', to: '/chat', also: [] },
  { key: 'me', label: 'Me', to: '/me', also: ['/profile'] },
];

export function activeTabKey(pathname: string): string {
  const hit = TABS.find((t) => [t.to, ...t.also].some((p) => pathname === p || pathname.startsWith(`${p}/`)));
  return hit?.key ?? 'ride';
}

export default function AppShell() {
  const { pathname } = useLocation();
  const { mode, theme, cycleMode } = useTheme();
  const current = activeTabKey(pathname);

  const modeLabel = mode === 'auto' ? 'Auto' : mode === 'day' ? 'Light' : 'Dark';

  return (
    <ShellContext.Provider value={true}>
      <div className="pz-shell">
        <header className="pz-top">
          <div className="pz-brand">Payanam</div>
          <div className="pz-grow pz-ctx">{TABS.find((t) => t.key === current)?.label}</div>
          <button
            className="pz-icon-btn"
            type="button"
            onClick={cycleMode}
            aria-label={`Theme: ${modeLabel}. Tap to change.`}
            title={`Showing the ${theme === 'day' ? 'light' : 'dark'} theme`}
          >
            {modeLabel}
          </button>
        </header>
        <main className="pz-main" id="pz-scroll">
          <Outlet />
        </main>
        <nav className="pz-tabs" aria-label="Main">
          {TABS.map((t) => (
            <NavLink
              key={t.key}
              to={t.to}
              aria-current={current === t.key ? 'page' : undefined}
              end={false}
            >
              {ICONS[t.key]}
              <span>{t.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </ShellContext.Provider>
  );
}
