import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import MobileBottomNav from './MobileBottomNav';
import JoinConvoyModal from './JoinConvoyModal';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { theme, mode, cycleMode } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [showJoinModal, setShowJoinModal] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path;

  const firstName = user?.fullName?.split(' ')[0] ?? 'Rider';
  const initial = user?.fullName?.[0]?.toUpperCase() ?? 'R';

  // Mode button text and badge
  const modeLabel =
    mode === 'auto'
      ? `⏱️ Auto (${theme === 'day' ? '☀️ Sun' : '🌙 Moon'})`
      : mode === 'day'
      ? '☀️ Sunlight'
      : '🌙 Moon';

  const modeTooltip =
    mode === 'auto'
      ? 'Automatic: Daylight / Sunlight UI from 6 AM to 6:30 PM, Moon Stealth UI after dusk. Click to cycle.'
      : mode === 'day'
      ? 'Sunlight High-Visibility Mode (high contrast for bright outdoor riding). Click to cycle.'
      : 'Moon Stealth Mode (glare-free dark palette for dusk and night rides). Click to cycle.';

  return (
    <>
      <nav style={styles.nav}>
        <div className="navbar-inner" style={styles.inner}>
          {/* Brand */}
          <Link to="/dashboard" style={styles.brand}>
            <span style={styles.logoIcon}>🏍️</span>
            <div>
              <span style={styles.brandTitle}>PAYANAM</span>
              <span className="navbar-brand-sub" style={styles.brandSub}>Touring & Convoy</span>
            </div>
          </Link>

          {/* Center Links (Desktop only - hidden on mobile via desktop-nav-links) */}
          <div className="desktop-nav-links" style={styles.navLinks}>
            <Link
              to="/dashboard"
              style={{
                ...styles.navLink,
                color: isActive('/dashboard') ? 'var(--text-primary)' : 'var(--text-secondary)',
                background: isActive('/dashboard') ? 'var(--accent-cyan-bg)' : 'transparent',
              }}
            >
              🗺️ Dashboard
            </Link>
            <Link
              to="/trips/new"
              style={{
                ...styles.navLink,
                color: isActive('/trips/new') ? 'var(--text-primary)' : 'var(--text-secondary)',
                background: isActive('/trips/new') ? 'var(--accent-cyan-bg)' : 'transparent',
              }}
            >
              ✨ Plan Trip
            </Link>
            <button
              onClick={() => setShowJoinModal(true)}
              style={styles.navBtnLink}
            >
              🤝 Join Convoy
            </button>
          </div>

          {/* Right Section: Theme Toggle + Profile + Logout (Desktop) */}
          <div style={styles.rightSection}>
            {/* Sunlight vs Moon Mode Switcher */}
            <button
              onClick={cycleMode}
              title={modeTooltip}
              className="navbar-theme-btn"
              style={{
                ...styles.themeToggleBtn,
                background: 'var(--accent-gold-bg)',
                color: 'var(--accent-gold)',
                borderColor: 'var(--accent-gold)',
              }}
            >
              <span className="desktop-theme-text">{modeLabel}</span>
              <span className="mobile-theme-icon">{mode === 'auto' ? '⏱️' : mode === 'day' ? '☀️' : '🌙'}</span>
            </button>

            {/* Profile Avatar / Passport Link */}
            <Link to="/profile" className="navbar-profile-chip" style={styles.profileChip} title="Rider Profile & Emergency SOS">
              <div style={styles.avatar}>{initial}</div>
              <span className="navbar-user-name" style={styles.userName}>{firstName}</span>
            </Link>

            {/* Sign out */}
            <button
              onClick={handleLogout}
              className="navbar-logout-btn"
              style={styles.logoutBtn}
              title="Sign out of Payanam"
            >
              <span style={{ fontSize: 13 }}>🚪</span>
              <span className="desktop-logout-text">Exit</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Reusable Mobile Bottom Navigation Bar */}
      <MobileBottomNav />

      {/* Reusable Join Convoy Modal */}
      <JoinConvoyModal
        isOpen={showJoinModal}
        onClose={() => setShowJoinModal(false)}
      />
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  nav: {
    position: 'sticky',
    top: 0,
    zIndex: 900,
    background: 'var(--bg-nav)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    borderBottom: '1px solid var(--border-nav)',
    transition: 'background-color 0.3s ease, border-color 0.3s ease',
  },
  inner: {
    maxWidth: 1200,
    margin: '0 auto',
    padding: '0 20px',
    height: 64,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    textDecoration: 'none',
  },
  logoIcon: {
    fontSize: 26,
    filter: 'drop-shadow(0 2px 8px rgba(245, 158, 11, 0.4))',
  },
  brandTitle: {
    display: 'block',
    fontSize: 18,
    fontWeight: 900,
    color: 'var(--text-primary)',
    letterSpacing: 1.5,
    lineHeight: 1.1,
  },
  brandSub: {
    display: 'block',
    fontSize: 10,
    fontWeight: 700,
    color: 'var(--accent-gold)',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  navLinks: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  navLink: {
    padding: '8px 14px',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    textDecoration: 'none',
    transition: 'all 0.2s ease',
  },
  navBtnLink: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-secondary)',
    padding: '8px 14px',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  rightSection: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  themeToggleBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 12px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    border: '1px solid',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    whiteSpace: 'nowrap',
  },
  profileChip: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: 'var(--bg-subtle)',
    border: '1px solid var(--border-card)',
    padding: '4px 12px 4px 6px',
    borderRadius: 999,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
    color: '#ffffff',
    fontWeight: 800,
    fontSize: 13,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userName: {
    color: 'var(--text-primary)',
    fontSize: 13,
    fontWeight: 600,
  },
  logoutBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.25)',
    color: '#ef4444',
    padding: '6px 10px',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.2s',
    flexShrink: 0,
  },
};
