import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  children: ReactNode;
  /** Allow phone sign-ups that have not finished onboarding (used by the onboarding route itself). */
  allowIncomplete?: boolean;
}

function ProtectedRoute({ children, allowIncomplete = false }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div className="pz-note" style={{ padding: 24 }}>Loading…</div>;
  }

  if (!isAuthenticated) {
    const here = location.pathname + location.search;
    const redirect = here && here !== '/' ? `?redirect=${encodeURIComponent(here)}` : '';
    return <Navigate to={`/welcome${redirect}`} replace />;
  }

  if (!allowIncomplete && user?.onboardingComplete === false) {
    return <Navigate to="/welcome" replace />;
  }

  return <>{children}</>;
}

export default ProtectedRoute;
