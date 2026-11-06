import React from 'react';
import { Link, useLocation } from 'react-router-dom';

export const MobileBottomNav: React.FC = () => {
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return location.pathname === '/dashboard' || location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="mobile-bottom-nav" aria-label="Mobile Navigation">
      <Link
        to="/dashboard"
        className={`mobile-nav-item ${isActive('/dashboard') ? 'active' : ''}`}
        aria-label="Expeditions"
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
        aria-label="Plan Trip"
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
        aria-label="Rider Profile"
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
    </nav>
  );
};

export default MobileBottomNav;
