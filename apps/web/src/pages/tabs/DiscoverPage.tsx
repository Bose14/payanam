import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { DiscoverTab } from '../../components';

export default function DiscoverPage() {
  const { user } = useAuth();
  const [toast, setToast] = useState('');

  return (
    <>
      <h1 className="pz-h1">Discover</h1>
      {toast && <div className="pz-banner ok" role="status">{toast}</div>}
      <DiscoverTab
        currentUser={user}
        onTripCopied={(draft) => {
          setToast(`Copied "${draft.title}" to your trips, with credit to the source.`);
          setTimeout(() => setToast(''), 3500);
        }}
      />
    </>
  );
}
