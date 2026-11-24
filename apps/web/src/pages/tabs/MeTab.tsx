import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme, ThemeMode } from '../../context/ThemeContext';
import { authService } from '../../services/api';

const MODES: Array<[ThemeMode, string]> = [['auto', 'Auto'], ['day', 'Light'], ['night', 'Dark']];

export default function MeTab() {
  const { user, logout } = useAuth();
  const { mode, setMode } = useTheme();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const initial = (user?.fullName || 'R').charAt(0).toUpperCase();
  const contact = user?.phone || user?.email || '';

  const signOut = () => {
    logout();
    navigate('/welcome', { replace: true });
  };

  const download = async () => {
    setBusy(true);
    setMessage('');
    try {
      const data = await authService.exportMyData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'payanam-my-data.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setMessage('Could not prepare your data. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const deleteAccount = async () => {
    setBusy(true);
    setMessage('');
    try {
      await authService.deleteMyAccount();
      logout();
      navigate('/welcome', { replace: true });
    } catch {
      setMessage('Could not delete your account. Try again.');
      setBusy(false);
    }
  };

  return (
    <>
      <h1 className="pz-h1">Me</h1>
      <div className="pz-card">
        <div className="pz-row" style={{ flexWrap: 'nowrap' }}>
          <div className="pz-av big cap" aria-hidden="true">{initial}</div>
          <div className="pz-grow">
            <div className="pz-h2" style={{ margin: 0 }}>{user?.fullName || 'Rider'}</div>
            <div className="pz-note">{[user?.city, contact].filter(Boolean).join(' · ')}</div>
            {user?.bike && <div className="pz-note">{user.bike}</div>}
          </div>
        </div>
      </div>

      <div className="pz-label">Rider profile</div>
      <div className="pz-card">
        <p className="pz-note" style={{ margin: '0 0 10px' }}>Blood group, emergency contact, bike and licence details for the SOS card.</p>
        <Link className="pz-btn small" to="/profile">Open rider profile</Link>
      </div>

      <div className="pz-label">Appearance</div>
      <div className="pz-seg" role="group" aria-label="Theme">
        {MODES.map(([m, label]) => (
          <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)}>{label}</button>
        ))}
      </div>

      <div className="pz-label">Privacy</div>
      <div className="pz-card">
        <p className="pz-note" style={{ margin: '0 0 10px' }}>
          Your position is shared only with members of the trips you join, and only while a trip is active. Your home start point is never shared.
        </p>
        <div className="pz-row">
          <button className="pz-btn small" type="button" onClick={download} disabled={busy}>Download my data</button>
          <button className="pz-btn small" type="button" onClick={() => setConfirmDelete(true)} disabled={busy}>Delete my account</button>
        </div>
        {confirmDelete && (
          <div className="pz-banner bad" role="alertdialog" style={{ marginTop: 12 }}>
            <b>Delete your account?</b>
            <div className="pz-note" style={{ margin: '4px 0 10px' }}>
              Your name, phone, email and rider profile are removed and you are signed out. Trips you led stay for the riders in them. This cannot be undone.
            </div>
            <div className="pz-row">
              <button className="pz-btn small" type="button" onClick={() => setConfirmDelete(false)}>Keep my account</button>
              <button className="pz-btn small primary" type="button" onClick={deleteAccount} disabled={busy}>Yes, delete</button>
            </div>
          </div>
        )}
        {message && <p role="alert" style={{ color: 'var(--pz-bad)', fontSize: 13 }}>{message}</p>}
      </div>

      <button className="pz-btn block" type="button" onClick={signOut}>Sign out</button>
    </>
  );
}
