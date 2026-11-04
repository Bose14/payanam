import React from 'react';
import { Link, useLocation } from 'react-router-dom';

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle: string;
}

export default function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  const location = useLocation();
  const isLogin = location.pathname === '/login';
  const isRegister = location.pathname === '/register';

  return (
    <div className="auth-container" style={styles.container}>
      {/* LEFT: Adventure Showcase Panel (Fixed 50% on desktop) */}
      <div className="auth-showcase" style={styles.showcase}>
        {/* Ambient background glow & decorative route curves */}
        <div style={styles.ambientGlowTop} />
        <div style={styles.ambientGlowBottom} />
        <svg
          style={styles.roadSvg}
          viewBox="0 0 500 800"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M-50 100 C150 180, 20 320, 220 400 C420 480, 280 650, 480 750"
            stroke="rgba(99, 102, 241, 0.18)"
            strokeWidth="3"
            strokeDasharray="8 8"
          />
          <path
            d="M50 -20 C250 120, 180 340, 350 450 C480 540, 320 720, 520 820"
            stroke="rgba(245, 158, 11, 0.15)"
            strokeWidth="2.5"
          />
          <circle cx="220" cy="400" r="5" fill="#f59e0b" />
          <circle cx="350" cy="450" r="5" fill="#6366f1" />
        </svg>

        <div style={styles.showcaseContent}>
          {/* Brand header */}
          <div style={styles.brandBadge}>
            <span style={styles.badgePulse}>●</span>
            <span>MOTORCYCLE & ROAD TRIP COMPANION</span>
          </div>

          <div style={styles.logoRow}>
            <div style={styles.logoIconWrapper}>
              <span style={{ fontSize: '26px' }}>🏍️</span>
            </div>
            <div>
              <h1 style={styles.brandTitle}>PAYANAM</h1>
              <span style={styles.brandSub}>AI Touring & Convoy Platform</span>
            </div>
          </div>

          {/* Hero text */}
          <div style={styles.heroBlock}>
            <h2 style={styles.heroHeadline}>
              Turn every highway into an unforgettable story.
            </h2>
            <p style={styles.heroDescription}>
              Smart day-by-day itineraries with biker-specific fuel stops, live GPS telemetry with heading compass, and instant group expense splitting.
            </p>
          </div>

          {/* Feature Highlights Grid */}
          <div className="auth-showcase-features" style={styles.featureList}>
            <div style={styles.featureItem}>
              <div style={styles.featureIcon}>🗺️</div>
              <div>
                <h4 style={styles.featureTitle}>AI Route Planner</h4>
                <p style={styles.featureDesc}>Tailored for twists, scenic detours, and fuel-range stops.</p>
              </div>
            </div>

            <div style={styles.featureItem}>
              <div style={styles.featureIcon}>📡</div>
              <div>
                <h4 style={styles.featureTitle}>Live Convoy Telemetry</h4>
                <p style={styles.featureDesc}>Real-time GPS tracking, heading arrows, convoy chat & emergency SOS.</p>
              </div>
            </div>

            <div style={styles.featureItem}>
              <div style={styles.featureIcon}>💳</div>
              <div>
                <h4 style={styles.featureTitle}>Smart Expense Split</h4>
                <p style={styles.featureDesc}>Equal or custom splits with automatic debt simplification.</p>
              </div>
            </div>
          </div>

          {/* Floating simulated ride card */}
          <div className="auth-showcase-sim" style={styles.simCard}>
            <div style={styles.simHeader}>
              <div style={styles.simLiveBadge}>
                <span style={styles.simPulse}></span> LIVE CONVOY
              </div>
              <span style={styles.simTripName}>Western Ghats Circuit</span>
            </div>
            <div style={styles.simMetrics}>
              <div style={styles.simMetric}>
                <span style={styles.simMetricVal}>248 km</span>
                <span style={styles.simMetricLbl}>Progress</span>
              </div>
              <div style={styles.simMetric}>
                <span style={styles.simMetricVal}>64 km/h</span>
                <span style={styles.simMetricLbl}>Convoy Avg</span>
              </div>
              <div style={styles.simMetric}>
                <span style={styles.simMetricVal}>4 Riders</span>
                <span style={styles.simMetricLbl}>Connected</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT: Modern Form Panel (Fixed 50% on desktop) */}
      <div className="auth-form-panel" style={styles.formPanel}>
        <div className="auth-form-card" style={styles.formCard}>
          {/* Auth Tab switcher (Login / Register) */}
          {(isLogin || isRegister) && (
            <div style={styles.tabContainer}>
              <Link
                to="/login"
                style={{
                  ...styles.tabBtn,
                  ...(isLogin ? styles.tabActive : styles.tabInactive),
                }}
              >
                Sign In
              </Link>
              <Link
                to="/register"
                style={{
                  ...styles.tabBtn,
                  ...(isRegister ? styles.tabActive : styles.tabInactive),
                }}
              >
                Create Account
              </Link>
            </div>
          )}

          {/* Page header */}
          <div style={styles.formHeader}>
            <h2 style={styles.formTitle}>{title}</h2>
            <p style={styles.formSubtitle}>{subtitle}</p>
          </div>

          {/* Form body */}
          {children}

          {/* Footer note */}
          <div style={styles.footerNote}>
            <span>🔒 Secure 256-bit encrypted authentication</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    height: '100vh',
    maxHeight: '100vh',
    width: '100vw',
    overflow: 'hidden',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    background: '#0f172a',
    color: '#0f172a',
    boxSizing: 'border-box',
  },
  showcase: {
    flex: '1 1 50%',
    width: '50%',
    height: '100%',
    position: 'relative',
    overflowY: 'auto',
    overflowX: 'hidden',
    background: 'linear-gradient(145deg, #0b0f19 0%, #111827 50%, #1e1b4b 100%)',
    padding: '40px 48px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    boxSizing: 'border-box',
    borderRight: '1px solid rgba(255, 255, 255, 0.08)',
  },
  ambientGlowTop: {
    position: 'absolute',
    top: '-80px',
    left: '-80px',
    width: '380px',
    height: '380px',
    background: 'radial-gradient(circle, rgba(99, 102, 241, 0.28) 0%, rgba(99, 102, 241, 0) 70%)',
    borderRadius: '50%',
    pointerEvents: 'none',
  },
  ambientGlowBottom: {
    position: 'absolute',
    bottom: '-100px',
    right: '-100px',
    width: '420px',
    height: '420px',
    background: 'radial-gradient(circle, rgba(245, 158, 11, 0.18) 0%, rgba(245, 158, 11, 0) 70%)',
    borderRadius: '50%',
    pointerEvents: 'none',
  },
  roadSvg: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    opacity: 0.6,
    pointerEvents: 'none',
  },
  showcaseContent: {
    position: 'relative',
    zIndex: 2,
    maxWidth: '480px',
    margin: 'auto',
    width: '100%',
  },
  brandBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '5px 12px',
    background: 'rgba(255, 255, 255, 0.07)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '100px',
    fontSize: '10.5px',
    fontWeight: 700,
    letterSpacing: '1px',
    color: '#fbbf24',
    marginBottom: '20px',
  },
  badgePulse: {
    color: '#10b981',
    fontSize: '10px',
  },
  logoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '24px',
  },
  logoIconWrapper: {
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, #3b82f6 0%, #1e3a8a 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 8px 24px rgba(59, 130, 246, 0.35)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
  },
  brandTitle: {
    fontSize: '24px',
    fontWeight: 800,
    color: '#ffffff',
    letterSpacing: '1.5px',
    margin: 0,
    lineHeight: 1.1,
  },
  brandSub: {
    fontSize: '12.5px',
    color: '#94a3b8',
    fontWeight: 500,
  },
  heroBlock: {
    marginBottom: '24px',
  },
  heroHeadline: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#f8fafc',
    lineHeight: 1.3,
    marginBottom: '10px',
    letterSpacing: '-0.3px',
  },
  heroDescription: {
    fontSize: '14px',
    color: '#cbd5e1',
    lineHeight: 1.55,
    margin: 0,
  },
  featureList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginBottom: '24px',
  },
  featureItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    background: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid rgba(255, 255, 255, 0.07)',
    borderRadius: '12px',
    padding: '10px 14px',
    backdropFilter: 'blur(8px)',
  },
  featureIcon: {
    fontSize: '20px',
    lineHeight: 1,
    marginTop: '2px',
  },
  featureTitle: {
    fontSize: '13.5px',
    fontWeight: 600,
    color: '#f1f5f9',
    margin: '0 0 2px',
  },
  featureDesc: {
    fontSize: '12px',
    color: '#94a3b8',
    margin: 0,
    lineHeight: 1.35,
  },
  simCard: {
    background: 'rgba(15, 23, 42, 0.75)',
    border: '1px solid rgba(99, 102, 241, 0.35)',
    borderRadius: '12px',
    padding: '14px 18px',
    boxShadow: '0 10px 28px rgba(0, 0, 0, 0.4)',
  },
  simHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px',
  },
  simLiveBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '10.5px',
    fontWeight: 700,
    color: '#10b981',
    background: 'rgba(16, 185, 129, 0.15)',
    padding: '3px 8px',
    borderRadius: '6px',
    letterSpacing: '0.5px',
  },
  simPulse: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: '#10b981',
    display: 'inline-block',
  },
  simTripName: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#e2e8f0',
  },
  simMetrics: {
    display: 'flex',
    justifyContent: 'space-between',
  },
  simMetric: {
    display: 'flex',
    flexDirection: 'column',
  },
  simMetricVal: {
    fontSize: '15px',
    fontWeight: 700,
    color: '#f8fafc',
  },
  simMetricLbl: {
    fontSize: '10.5px',
    color: '#94a3b8',
    marginTop: '2px',
  },
  formPanel: {
    flex: '1 1 50%',
    width: '50%',
    height: '100%',
    background: '#f8fafc',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px 24px',
    overflowY: 'auto',
    overflowX: 'hidden',
    boxSizing: 'border-box',
  },
  formCard: {
    width: '100%',
    maxWidth: '430px',
    background: '#ffffff',
    borderRadius: '20px',
    padding: '36px 32px',
    boxShadow: '0 10px 40px -10px rgba(15, 23, 42, 0.12), 0 0 1px 1px rgba(15, 23, 42, 0.05)',
    boxSizing: 'border-box',
    margin: 'auto 0',
  },
  tabContainer: {
    display: 'flex',
    background: '#f1f5f9',
    borderRadius: '10px',
    padding: '4px',
    marginBottom: '22px',
  },
  tabBtn: {
    flex: 1,
    textAlign: 'center',
    padding: '9px 12px',
    borderRadius: '8px',
    fontSize: '13.5px',
    fontWeight: 600,
    transition: 'all 0.15s ease',
  },
  tabActive: {
    background: '#ffffff',
    color: '#0f172a',
    boxShadow: '0 2px 8px rgba(15, 23, 42, 0.08)',
  },
  tabInactive: {
    color: '#64748b',
    background: 'transparent',
  },
  formHeader: {
    marginBottom: '20px',
  },
  formTitle: {
    fontSize: '22px',
    fontWeight: 700,
    color: '#0f172a',
    margin: '0 0 6px',
    letterSpacing: '-0.3px',
  },
  formSubtitle: {
    fontSize: '13.5px',
    color: '#64748b',
    margin: 0,
    lineHeight: 1.5,
  },
  footerNote: {
    textAlign: 'center',
    marginTop: '22px',
    paddingTop: '14px',
    borderTop: '1px solid #f1f5f9',
    fontSize: '12px',
    color: '#94a3b8',
  },
};
