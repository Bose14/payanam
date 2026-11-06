import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { theme, mode, cycleMode } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [inviteCode, setInviteCode] = useState('');

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    const clean = inviteCode.trim().toUpperCase();
    setShowJoinModal(false);
    navigate(`/join/${clean}`);
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

      {/* Mobile Bottom Navigation Bar (Fixed at bottom for thumb ergonomics on phone screens - 3 core tabs with Vector SVGs) */}
      <div className="mobile-bottom-nav">
        <Link
          to="/dashboard"
          className={`mobile-nav-item ${isActive('/dashboard') ? 'active' : ''}`}
        >
          <span className="mobile-nav-icon-wrap">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={isActive('/dashboard') ? '2.4' : '1.8'}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
              <line x1="9" y1="3" x2="9" y2="18" />
              <line x1="15" y1="6" x2="15" y2="21" />
            </svg>
          </span>
          <span>Expeditions</span>
        </Link>
        <Link
          to="/trips/new"
          className={`mobile-nav-item ${isActive('/trips/new') ? 'active' : ''}`}
        >
          <span className="mobile-nav-icon-wrap">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={isActive('/trips/new') ? '2.4' : '1.8'}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="6" cy="19" r="3" />
              <path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" />
              <circle cx="18" cy="5" r="3" />
            </svg>
          </span>
          <span>Plan Trip</span>
        </Link>
        <Link
          to="/profile"
          className={`mobile-nav-item ${isActive('/profile') ? 'active' : ''}`}
        >
          <span className="mobile-nav-icon-wrap">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={isActive('/profile') ? '2.4' : '1.8'}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" fill={isActive('/profile') ? 'currentColor' : 'none'} />
            </svg>
          </span>
          <span>Profile</span>
        </Link>
      </div>

      {/* Join Convoy Modal */}
      {showJoinModal && (
        <div style={styles.modalBackdrop}>
          <div style={styles.modalCard}>
            <div style={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 24 }}>🔑</span>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
                  Join Convoy Expedition
                </h3>
              </div>
              <button onClick={() => setShowJoinModal(false)} style={styles.closeBtn}>✕</button>
            </div>
            <p style={{ margin: '0 0 16px', fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Enter the invite code shared by your convoy leader:
            </p>
            <form onSubmit={handleJoinSubmit}>
              <input
                type="text"
                placeholder="e.g. TRP89X"
                value={inviteCode}
                onChange={e => setInviteCode(e.target.value.toUpperCase())}
                maxLength={12}
                autoFocus
                style={styles.codeInput}
              />
              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <button
                  type="button"
                  onClick={() => setShowJoinModal(false)}
                  style={styles.btnCancel}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!inviteCode.trim()}
                  style={{
                    ...styles.btnSubmit,
                    opacity: inviteCode.trim() ? 1 : 0.5,
                  }}
                >
                  Join Trip →
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
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
  modalBackdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 23, 42, 0.75)',
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: 16,
  },
  modalCard: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-card)',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 420,
    boxShadow: 'var(--card-shadow)',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: 20,
    cursor: 'pointer',
  },
  codeInput: {
    width: '100%',
    padding: '12px 16px',
    background: 'var(--bg-subtle)',
    border: '1px solid var(--border-input)',
    borderRadius: 10,
    color: 'var(--text-primary)',
    fontSize: 20,
    fontWeight: 800,
    letterSpacing: 3,
    textAlign: 'center',
    textTransform: 'uppercase',
    outline: 'none',
    boxSizing: 'border-box',
  },
  btnCancel: {
    flex: 1,
    padding: '11px',
    background: 'var(--bg-subtle)',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border-card)',
    borderRadius: 8,
    fontWeight: 600,
    fontSize: 14,
    cursor: 'pointer',
  },
  btnSubmit: {
    flex: 1,
    padding: '11px',
    background: 'var(--btn-primary-bg)',
    color: 'var(--btn-primary-text)',
    border: 'none',
    borderRadius: 8,
    fontWeight: 700,
    fontSize: 14,
    cursor: 'pointer',
  },
};
