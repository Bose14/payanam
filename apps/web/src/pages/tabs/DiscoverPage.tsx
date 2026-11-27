import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../context/AuthContext';
import DiscoverTab from '../../components/DiscoverTab';

export default function DiscoverPage() {
  const { user } = useAuth();
  const [toast, showToast] = useToast();

  return (
    <>
      <h1 className="pz-h1">Discover</h1>
      {toast && <div className="pz-banner ok" role="status">{toast}</div>}
      <DiscoverTab
        currentUser={user}
        onTripCopied={(draft) => {
          showToast(`Copied "${draft.title}" to your trips, with credit to the source.`);
        }}
      />
    </>
  );
}
