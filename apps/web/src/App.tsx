import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import { enablePush } from './utils/push';
import { resumeLiveShares } from './utils/liveShare';
import { getResumeRide, clearResumeRide } from './utils/rideResume';
import { rideService } from './services/api';
import ProtectedRoute from './components/ProtectedRoute';
import AppShell from './components/shell/AppShell';

// Each screen is loaded when it is first opened, so the first page does not carry the ride screen's code.
const CreateTripPage = lazy(() => import('./pages/CreateTripPage'));
const TripDetailPage = lazy(() => import('./pages/TripDetailPage'));
const JoinRoomPage = lazy(() => import('./pages/JoinRoomPage'));
const RidePage = lazy(() => import('./pages/RidePage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const ChatTab = lazy(() => import('./pages/tabs/ChatTab'));
const DiscoverPage = lazy(() => import('./pages/tabs/DiscoverPage'));
const MeTab = lazy(() => import('./pages/tabs/MeTab'));
const PlanTab = lazy(() => import('./pages/tabs/PlanTab'));
const RideTab = lazy(() => import('./pages/tabs/RideTab'));
const WelcomePage = lazy(() => import('./pages/WelcomePage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));

function Home() {
  const { isAuthenticated, isLoading } = useAuth();
  const [target, setTarget] = useState<string | null>(null);
  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) { setTarget('/welcome'); return; }
    // Opened the app while a ride is still live: go straight back into it.
    const last = getResumeRide();
    if (!last) { setTarget('/ride'); return; }
    let alive = true;
    rideService.getSessionById(last.sessionId)
      .then((d) => {
        if (!alive) return;
        if (d.session.status === 'active') setTarget(`/ride/${last.sessionId}`);
        else { clearResumeRide(); setTarget('/ride'); }
      })
      .catch(() => { if (alive) setTarget('/ride'); });
    return () => { alive = false; };
  }, [isAuthenticated, isLoading]);
  if (!target) return <div className="pz-note" style={{ padding: 24 }}>Loading…</div>;
  return <Navigate to={target} replace state={target.startsWith('/ride/') ? { resumed: true } : undefined} />;
}

/** Once signed in with permission granted, keep this device subscribed to push. */
function PushSync() {
  const { isAuthenticated } = useAuth();
  useEffect(() => { if (isAuthenticated) { void enablePush(); resumeLiveShares(); } }, [isAuthenticated]);
  return null;
}

function App() {
  return (
    <Router>
      <ThemeProvider>
        <AuthProvider>
          <PushSync />
          <Suspense fallback={<div className="pz-loading" role="status" aria-label="Loading" style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', color: 'var(--pz-muted, #888)' }}>Loading…</div>}>
          <Routes>
            <Route path="/" element={<Home />} />

            {/* Signed-out entry points */}
            <Route path="/welcome" element={<WelcomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            {/* Signed-in app: five persistent tabs (Ride, Plan, Discover, Chat, Me) */}
            <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
              <Route path="/ride" element={<RideTab />} />
              <Route path="/plan" element={<PlanTab />} />
              <Route path="/discover" element={<DiscoverPage />} />
              <Route path="/chat" element={<ChatTab />} />
              <Route path="/me" element={<MeTab />} />

              <Route path="/trips/new" element={<CreateTripPage />} />
              <Route path="/trips/:id" element={<TripDetailPage />} />
              <Route path="/join/:inviteCode" element={<JoinRoomPage />} />
              <Route path="/profile" element={<ProfilePage />} />
            </Route>

            {/* Old paths keep working */}
            <Route path="/dashboard" element={<Navigate to="/plan" replace />} />

            {/* The live ride screen is full-screen with its own controls */}
            <Route
              path="/ride/:sessionId"
              element={
                <ProtectedRoute>
                  <RidePage />
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>
        </AuthProvider>
      </ThemeProvider>
    </Router>
  );
}

export default App;
