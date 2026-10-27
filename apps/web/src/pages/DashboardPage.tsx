import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Dashboard</h1>
        <button
          onClick={handleLogout}
          style={{
            padding: '10px 20px',
            backgroundColor: '#dc3545',
            color: 'white',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Logout
        </button>
      </div>

      {user && (
        <div
          style={{
            backgroundColor: '#f8f9fa',
            padding: '20px',
            borderRadius: '4px',
            marginTop: '20px',
          }}
        >
          <h2>Welcome, {user.fullName}!</h2>
          <p>Email: {user.email}</p>
          <p>Account Status: {user.status}</p>
          <p>Member since: {new Date(user.createdAt).toLocaleDateString()}</p>
        </div>
      )}

      <div style={{ marginTop: '30px' }}>
        <h3>Application is Ready</h3>
        <p>Your Payanam application is running successfully!</p>
        <p>Frontend connected to backend API and authentication is working.</p>
      </div>
    </div>
  );
}

export default DashboardPage;
