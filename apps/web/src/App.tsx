import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import WelcomePage from './pages/WelcomePage';
import CreateTripPage from './pages/CreateTripPage';
import TripDetailPage from './pages/TripDetailPage';
import JoinRoomPage from './pages/JoinRoomPage';
import RidePage from './pages/RidePage';
import ProfilePage from './pages/ProfilePage';
import PlanTab from './pages/tabs/PlanTab';
import RideTab from './pages/tabs/RideTab';
import DiscoverPage from './pages/tabs/DiscoverPage';
import ChatTab from './pages/tabs/ChatTab';
import MeTab from './pages/tabs/MeTab';
import { enablePush } from './utils/push';
import { resumeLiveShares } from './utils/liveShare';
import { getResumeRide, clearResumeRide } from './utils/rideResume';
import { rideService } from './services/api';
import ProtectedRoute from './components/ProtectedRoute';
import AppShell from './components/shell/AppShell';

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
        </AuthProvider>
      </ThemeProvider>
    </Router>
  );
}

export default App;
