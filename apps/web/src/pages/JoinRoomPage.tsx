import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { tripService } from '../services/api';

function JoinRoomPage() {
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    if (!inviteCode) return;
    tripService.joinRoom(inviteCode)
      .then((data) => {
        const tripId = data.room?.trip_id ?? data.room?.trips?.id;
        if (tripId) {
          navigate(`/trips/${tripId}`, { replace: true });
        } else {
          navigate('/dashboard', { replace: true });
        }
      })
      .catch((err) => setError(err.message ?? 'Invalid invite link'));
  }, [inviteCode, navigate]);

  if (error) {
    return (
      <div style={styles.center}>
        <div style={{ fontSize: '40px' }}>❌</div>
        <p style={{ color: '#dc2626', fontSize: '16px' }}>{error}</p>
        <a href="/dashboard" style={{ color: '#0f3460', fontSize: '14px' }}>Back to dashboard</a>
      </div>
    );
  }

  return (
    <div style={styles.center}>
      <div style={{ fontSize: '40px' }}>⏳</div>
      <p style={{ color: '#6b7280', fontSize: '16px' }}>Joining trip room...</p>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  center: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    fontFamily: 'system-ui, sans-serif',
  },
};

export default JoinRoomPage;
