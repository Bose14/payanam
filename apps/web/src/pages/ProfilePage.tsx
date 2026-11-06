import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { profileService, RiderProfile } from '../services/api';
import Navbar from '../components/Navbar';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const RIDING_STYLES = [
  'Adventure / Touring',
  'Cruiser / Highway',
  'Sport / Cornering',
  'Off-Road / Trails',
  'Daily Commuter',
];
const RELATIONS = ['Spouse', 'Parent', 'Sibling', 'Riding Partner', 'Friend', 'Other'];

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [, setProfile] = useState<RiderProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [showSosModal, setShowSosModal] = useState(false);

  // Form states
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [emergencyRelation, setEmergencyRelation] = useState('Parent');
  const [allergies, setAllergies] = useState('');
  const [medicalNotes, setMedicalNotes] = useState('');
  const [bikeModel, setBikeModel] = useState('');
  const [bikeRegNo, setBikeRegNo] = useState('');
  const [drivingLicenseNo, setDrivingLicenseNo] = useState('');
  const [ridingStyle, setRidingStyle] = useState('Adventure / Touring');
  const [city, setCity] = useState('');
  const [bio, setBio] = useState('');

  const showNotification = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

  useEffect(() => {
    profileService
      .getProfile()
      .then((data) => {
        const p = data.profile;
        setProfile(p);
        setFullName(p.fullName || user?.fullName || '');
        setPhone(p.phone || '');
        setBloodGroup(p.bloodGroup || '');
        setEmergencyName(p.emergencyContactName || '');
        setEmergencyPhone(p.emergencyContactPhone || '');
        setEmergencyRelation(p.emergencyContactRelation || 'Parent');
        setAllergies(p.allergies || '');
        setMedicalNotes(p.medicalNotes || '');
        setBikeModel(p.bikeModel || '');
        setBikeRegNo(p.bikeRegNo || '');
        setDrivingLicenseNo(p.drivingLicenseNo || '');
        setRidingStyle(p.ridingStyle || 'Adventure / Touring');
        setCity(p.city || '');
        setBio(p.bio || '');
      })
      .catch((err) => {
        console.error('Failed to load profile:', err);
        setFullName(user?.fullName || '');
      })
      .finally(() => setLoading(false));
  }, [user]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await profileService.updateProfile({
        fullName,
        phone,
        bloodGroup,
        emergencyContactName: emergencyName,
        emergencyContactPhone: emergencyPhone,
        emergencyContactRelation: emergencyRelation,
        allergies,
        medicalNotes,
        bikeModel,
        bikeRegNo,
        drivingLicenseNo,
        ridingStyle,
        city,
        bio,
      });
      setProfile(res.profile);
      if (res.profile) {
        setFullName(res.profile.fullName || fullName);
        setPhone(res.profile.phone || phone);
        setBloodGroup(res.profile.bloodGroup || bloodGroup);
        setEmergencyName(res.profile.emergencyContactName || emergencyName);
        setEmergencyPhone(res.profile.emergencyContactPhone || emergencyPhone);
        setEmergencyRelation(res.profile.emergencyContactRelation || emergencyRelation);
        setAllergies(res.profile.allergies || allergies);
        setMedicalNotes(res.profile.medicalNotes || medicalNotes);
        setBikeModel(res.profile.bikeModel || bikeModel);
        setBikeRegNo(res.profile.bikeRegNo || bikeRegNo);
        setDrivingLicenseNo(res.profile.drivingLicenseNo || drivingLicenseNo);
        setRidingStyle(res.profile.ridingStyle || ridingStyle);
        setCity(res.profile.city || city);
        setBio(res.profile.bio || bio);
      }
      showNotification('✅ Rider Profile & SOS info saved!');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update profile. Please try again.';
      showNotification(`❌ ${message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleShareSosWhatsApp = () => {
    if (!emergencyPhone) {
      showNotification('⚠️ Please add an emergency contact number first.');
      return;
    }
    const cleanPhone = emergencyPhone.replace(/\D/g, '');
    const msg = `🚨 *PAYANAM RIDER SOS CARD*\n\n*Rider:* ${fullName || 'Rider'}\n*Blood Group:* ${bloodGroup || 'Not specified'}\n*Motorcycle:* ${bikeModel || 'N/A'} (${bikeRegNo || 'No Plate'})\n*Emergency Contact:* ${emergencyName} (${emergencyRelation}) - ${emergencyPhone}\n*Allergies:* ${allergies || 'None'}\n*Medical Notes:* ${medicalNotes || 'None'}\n\n_Generated via Payanam Touring_`;
    const url = `https://wa.me/${cleanPhone.startsWith('91') ? cleanPhone : '91' + cleanPhone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  const initial = (fullName || user?.fullName || 'R')[0]?.toUpperCase();

  return (
    <div style={styles.page}>
      <Navbar />

      {/* Floating Toast */}
      {toast && <div style={styles.toast}>{toast}</div>}

      <main className="responsive-page-container" style={styles.container}>
        {/* Back Link */}
        <div style={{ marginBottom: 16 }}>
          <Link to="/dashboard" style={styles.backLink}>
            ← Back to Dashboard
          </Link>
        </div>

        {/* Hero Passport Banner */}
        <div className="responsive-hero" style={styles.heroCard}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
            <div style={styles.avatar}>
              {initial}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
                <h1 style={styles.heroTitle}>{fullName || 'Rider Profile'}</h1>
                {bloodGroup && (
                  <span style={styles.bloodBadge}>
                    🩸 {bloodGroup}
                  </span>
                )}
                <span style={styles.styleBadge}>
                  🏍️ {ridingStyle}
                </span>
              </div>
              <p style={styles.heroSubtitle}>
                {user?.email} {city ? `• 📍 ${city}` : ''}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setShowSosModal(true)}
              style={styles.btnSosCard}
            >
              <span>🚨</span>
              <span>View SOS Rider Card</span>
            </button>
          </div>
        </div>

        {/* Form Container */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>⏳</div>
            <p style={{ fontWeight: 600 }}>Loading your rider passport...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Section 1: Emergency & Medical Safety */}
            <div className="responsive-card" style={styles.sectionCard}>
              <div style={styles.sectionHeader}>
                <div style={styles.sectionIconAmber}>🚨</div>
                <div>
                  <h2 style={styles.sectionTitle}>Emergency & Medical Safety</h2>
                  <p style={styles.sectionDesc}>
                    Critical data accessible to convoy leaders and medical responders in case of roadside emergency.
                  </p>
                </div>
              </div>

              {/* Blood Group Picker */}
              <div style={{ marginBottom: 20 }}>
                <label style={styles.label}>
                  🩸 Blood Group <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {BLOOD_GROUPS.map((bg) => {
                    const isSelected = bloodGroup === bg;
                    return (
                      <button
                        key={bg}
                        type="button"
                        onClick={() => setBloodGroup(isSelected ? '' : bg)}
                        style={{
                          ...styles.bloodPill,
                          background: isSelected ? '#ef4444' : 'var(--bg-subtle)',
                          color: isSelected ? '#ffffff' : 'var(--text-primary)',
                          borderColor: isSelected ? '#ef4444' : 'var(--border-subtle)',
                          transform: isSelected ? 'scale(1.05)' : 'none',
                        }}
                      >
                        {bg}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Emergency Contact Name & Phone */}
              <div style={styles.rowTwoCols}>
                <div>
                  <label style={styles.label}>
                    🚨 Emergency Contact Name <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={emergencyName}
                    onChange={(e) => setEmergencyName(e.target.value)}
                    placeholder="e.g. Ramesh Kumar"
                    style={styles.input}
                  />
                </div>

                <div>
                  <label style={styles.label}>
                    📞 Emergency Phone Number <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="tel"
                      value={emergencyPhone}
                      onChange={(e) => setEmergencyPhone(e.target.value)}
                      placeholder="e.g. 9876543210"
                      style={{ ...styles.input, flex: 1, minWidth: 0 }}
                    />
                    {emergencyPhone && (
                      <a
                        href={`tel:${emergencyPhone}`}
                        style={styles.btnDial}
                        title="Test Call"
                      >
                        📞 Call
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Relationship & City */}
              <div style={{ ...styles.rowTwoCols, marginTop: 16 }}>
                <div>
                  <label style={styles.label}>Relation to Rider</label>
                  <select
                    value={emergencyRelation}
                    onChange={(e) => setEmergencyRelation(e.target.value)}
                    style={styles.select}
                  >
                    {RELATIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={styles.label}>⚠️ Known Allergies</label>
                  <input
                    type="text"
                    value={allergies}
                    onChange={(e) => setAllergies(e.target.value)}
                    placeholder="e.g. Penicillin, Peanuts, Bee stings (or 'None')"
                    style={styles.input}
                  />
                </div>
              </div>

              {/* Medical Notes */}
              <div style={{ marginTop: 16 }}>
                <label style={styles.label}>📋 Medical Notes / Conditions</label>
                <textarea
                  value={medicalNotes}
                  onChange={(e) => setMedicalNotes(e.target.value)}
                  placeholder="e.g. Asthma inhaler in tank bag, Type 2 Diabetic, wears contact lenses."
                  rows={2}
                  style={styles.textarea}
                />
              </div>
            </div>

            {/* Section 2: Motorcycle & Gear Specifications */}
            <div className="responsive-card" style={styles.sectionCard}>
              <div style={styles.sectionHeader}>
                <div style={styles.sectionIconBlue}>🏍️</div>
                <div>
                  <h2 style={styles.sectionTitle}>Motorcycle & License Details</h2>
                  <p style={styles.sectionDesc}>
                    Helps the convoy recognize your bike and assists convoy sweeps with breakdowns.
                  </p>
                </div>
              </div>

              <div style={styles.rowTwoCols}>
                <div>
                  <label style={styles.label}>Bike Make & Model</label>
                  <input
                    type="text"
                    value={bikeModel}
                    onChange={(e) => setBikeModel(e.target.value)}
                    placeholder="e.g. Royal Enfield Himalayan 450"
                    style={styles.input}
                  />
                </div>

                <div>
                  <label style={styles.label}>Registration Number (Plate)</label>
                  <input
                    type="text"
                    value={bikeRegNo}
                    onChange={(e) => setBikeRegNo(e.target.value.toUpperCase())}
                    placeholder="e.g. TN 33 AB 1234"
                    style={{ ...styles.input, textTransform: 'uppercase', letterSpacing: 1 }}
                  />
                </div>
              </div>

              <div style={{ ...styles.rowTwoCols, marginTop: 16 }}>
                <div>
                  <label style={styles.label}>Driving License No.</label>
                  <input
                    type="text"
                    value={drivingLicenseNo}
                    onChange={(e) => setDrivingLicenseNo(e.target.value.toUpperCase())}
                    placeholder="e.g. TN33 20180001234"
                    style={{ ...styles.input, textTransform: 'uppercase' }}
                  />
                </div>

                <div>
                  <label style={styles.label}>Primary Riding Style</label>
                  <select
                    value={ridingStyle}
                    onChange={(e) => setRidingStyle(e.target.value)}
                    style={styles.select}
                  >
                    {RIDING_STYLES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Section 3: Rider Profile & Home Base */}
            <div className="responsive-card" style={styles.sectionCard}>
              <div style={styles.sectionHeader}>
                <div style={styles.sectionIconGold}>👤</div>
                <div>
                  <h2 style={styles.sectionTitle}>Personal & Contact Details</h2>
                  <p style={styles.sectionDesc}>
                    Your rider identity displayed across trip groups and member rosters.
                  </p>
                </div>
              </div>

              <div style={styles.rowTwoCols}>
                <div>
                  <label style={styles.label}>Full Name</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Your legal or rider name"
                    style={styles.input}
                  />
                </div>

                <div>
                  <label style={styles.label}>Personal Phone / WhatsApp</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. 9876543210"
                    style={styles.input}
                  />
                </div>
              </div>

              <div style={{ ...styles.rowTwoCols, marginTop: 16 }}>
                <div>
                  <label style={styles.label}>Home Base / City</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. Erode, Tamil Nadu"
                    style={styles.input}
                  />
                </div>

                <div>
                  <label style={styles.label}>Rider Bio & Interests</label>
                  <input
                    type="text"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="e.g. Long-haul tourer, ghats curve lover"
                    style={styles.input}
                  />
                </div>
              </div>
            </div>

            {/* Submit Action Bar */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
              <Link to="/dashboard" style={styles.btnSecondary}>
                Cancel
              </Link>
              <button
                type="submit"
                disabled={saving}
                style={styles.btnPrimary}
              >
                {saving ? 'Saving...' : '💾 Save Rider Profile'}
              </button>
            </div>
          </form>
        )}

        {/* Account & Session Management Card */}
        <div style={{ ...styles.sectionCard, marginTop: 24, borderColor: 'rgba(239, 68, 68, 0.3)' }}>
          <div style={styles.sectionHeader}>
            <div style={{ ...styles.sectionIconAmber, background: 'rgba(239, 68, 68, 0.15)' }}>
              🚪
            </div>
            <div style={{ flex: 1 }}>
              <h2 style={styles.sectionTitle}>Account & Session</h2>
              <p style={styles.sectionDesc}>
                Signed in as <strong>{user?.email}</strong>. Manage your active rider session or log out of this device.
              </p>
            </div>
          </div>

          <div className="profile-logout-row" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
            <button
              type="button"
              onClick={handleLogout}
              className="btn-mobile-full"
              style={styles.btnLogoutFull}
            >
              🚪 Sign Out of Account
            </button>
          </div>
        </div>
      </main>

      {/* SOS Rider Card Digital Modal */}
      {showSosModal && (
        <div style={styles.modalOverlay} onClick={() => setShowSosModal(false)}>
          <div
            style={styles.modalCard}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={styles.sosCardHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 26 }}>🚨</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: 'clamp(15px, 4vw, 18px)', fontWeight: 900, color: '#ffffff' }}>
                    EMERGENCY RIDER CARD
                  </h3>
                  <span style={{ fontSize: 10, color: '#fca5a5', textTransform: 'uppercase', letterSpacing: 1 }}>
                    Payanam Convoy Safety Passport
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowSosModal(false)}
                style={styles.modalCloseBtn}
                title="Close"
              >
                ✕
              </button>
            </div>

            <div style={{ padding: 'clamp(16px, 4vw, 24px) clamp(14px, 3vw, 20px)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
              {/* Highlight Row: Rider Name + Blood Group */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 16, gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 'min(100%, 140px)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 700, letterSpacing: 0.5 }}>RIDER NAME</div>
                  <div style={{ fontSize: 'clamp(17px, 4vw, 20px)', fontWeight: 900, color: 'var(--text-primary)', wordBreak: 'break-word' }}>{fullName || 'Rider'}</div>
                </div>
                <div style={{ ...styles.bloodBadgeLarge, flexShrink: 0 }}>
                  🩸 {bloodGroup || 'UNKNOWN'}
                </div>
              </div>

              {/* Emergency Contact Row */}
              <div style={styles.sosDataBox}>
                <div style={{ fontSize: 11, color: '#ef4444', fontWeight: 800, marginBottom: 4, letterSpacing: 0.5 }}>
                  🚨 PRIMARY EMERGENCY CONTACT
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                  {emergencyName || 'Not Set'} ({emergencyRelation || 'Contact'})
                </div>
                <div style={{ fontSize: 'clamp(15px, 4vw, 18px)', fontWeight: 900, color: 'var(--accent-cyan)', marginTop: 4, wordBreak: 'break-all' }}>
                  {emergencyPhone || 'No Phone Number Added'}
                </div>
                {emergencyPhone && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 130px), 1fr))', gap: 10, marginTop: 12 }}>
                    <a
                      href={`tel:${emergencyPhone}`}
                      style={styles.btnSosCall}
                    >
                      📞 One-Tap Dial
                    </a>
                    <button
                      type="button"
                      onClick={handleShareSosWhatsApp}
                      style={styles.btnSosWa}
                    >
                      💬 Alert on WhatsApp
                    </button>
                  </div>
                )}
              </div>

              {/* Bike & Medical Specs */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))', gap: 12, marginTop: 16 }}>
                <div style={styles.sosSmallBox}>
                  <div style={styles.sosSmallLabel}>MOTORCYCLE</div>
                  <div style={styles.sosSmallVal}>{bikeModel || 'N/A'}</div>
                  <div style={{ fontSize: 12, color: 'var(--accent-gold)', fontWeight: 800, marginTop: 2, wordBreak: 'break-all' }}>
                    {bikeRegNo || 'No Plate'}
                  </div>
                </div>

                <div style={styles.sosSmallBox}>
                  <div style={styles.sosSmallLabel}>ALLERGIES</div>
                  <div style={{ ...styles.sosSmallVal, color: allergies ? '#ef4444' : 'var(--text-primary)' }}>
                    {allergies || 'None Reported'}
                  </div>
                </div>
              </div>

              {medicalNotes && (
                <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--bg-subtle)', borderRadius: 8 }}>
                  <div style={styles.sosSmallLabel}>MEDICAL NOTES / CONDITIONS</div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)', marginTop: 2, wordBreak: 'break-word' }}>{medicalNotes}</div>
                </div>
              )}
            </div>

            <div style={{ padding: '14px 20px', background: 'var(--bg-subtle)', borderTop: '1px solid var(--border-subtle)', textAlign: 'center' }}>
              <button
                onClick={() => setShowSosModal(false)}
                style={styles.btnPrimary}
              >
                Close SOS Card
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: 'var(--bg-page)',
    color: 'var(--text-primary)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  container: {
    maxWidth: 880,
    margin: '0 auto',
    padding: '28px 20px 80px',
  },
  backLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    color: 'var(--text-secondary)',
    textDecoration: 'none',
    fontSize: 14,
    fontWeight: 600,
  },
  heroCard: {
    background: 'var(--bg-hero)',
    border: '1px solid var(--border-card)',
    borderRadius: 20,
    padding: '28px 24px',
    marginBottom: 24,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 20,
    boxShadow: 'var(--card-shadow)',
    color: '#ffffff',
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 28,
    fontWeight: 900,
    color: '#ffffff',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    flexShrink: 0,
  },
  heroTitle: {
    margin: 0,
    fontSize: 24,
    fontWeight: 900,
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    margin: 0,
    fontSize: 14,
    color: '#cbd5e1',
  },
  bloodBadge: {
    padding: '4px 10px',
    background: '#dc2626',
    color: '#ffffff',
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 900,
    letterSpacing: 0.5,
  },
  styleBadge: {
    padding: '4px 10px',
    background: 'rgba(255, 255, 255, 0.15)',
    color: '#ffffff',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
  },
  btnSosCard: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 20px',
    background: '#dc2626',
    color: '#ffffff',
    border: 'none',
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(220, 38, 38, 0.4)',
    whiteSpace: 'nowrap',
  },
  sectionCard: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-card)',
    borderRadius: 16,
    padding: '24px 22px',
    boxShadow: 'var(--card-shadow)',
    color: 'var(--text-primary)',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 14,
    marginBottom: 20,
    paddingBottom: 16,
    borderBottom: '1px solid var(--border-subtle)',
  },
  sectionIconAmber: {
    width: 44,
    height: 44,
    borderRadius: 12,
    background: 'rgba(239, 68, 68, 0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 22,
    flexShrink: 0,
  },
  sectionIconBlue: {
    width: 44,
    height: 44,
    borderRadius: 12,
    background: 'var(--accent-cyan-bg)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 22,
    flexShrink: 0,
  },
  sectionIconGold: {
    width: 44,
    height: 44,
    borderRadius: 12,
    background: 'var(--accent-gold-bg)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 22,
    flexShrink: 0,
  },
  sectionTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 800,
    color: 'var(--text-primary)',
  },
  sectionDesc: {
    margin: '4px 0 0',
    fontSize: 13,
    color: 'var(--text-secondary)',
    lineHeight: 1.4,
  },
  label: {
    display: 'block',
    fontSize: 12,
    fontWeight: 800,
    color: 'var(--text-secondary)',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bloodPill: {
    padding: '8px 16px',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 800,
    border: '1px solid var(--border-subtle)',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  rowTwoCols: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: 16,
  },
  input: {
    width: '100%',
    padding: '11px 14px',
    background: 'var(--bg-input)',
    border: '1px solid var(--border-input)',
    borderRadius: 10,
    color: 'var(--text-primary)',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
    fontWeight: 600,
  },
  select: {
    width: '100%',
    padding: '11px 14px',
    background: 'var(--bg-input)',
    border: '1px solid var(--border-input)',
    borderRadius: 10,
    color: 'var(--text-primary)',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
    fontWeight: 600,
    cursor: 'pointer',
  },
  textarea: {
    width: '100%',
    padding: '11px 14px',
    background: 'var(--bg-input)',
    border: '1px solid var(--border-input)',
    borderRadius: 10,
    color: 'var(--text-primary)',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    lineHeight: 1.5,
  },
  btnDial: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '0 16px',
    background: '#10b981',
    color: '#ffffff',
    borderRadius: 10,
    textDecoration: 'none',
    fontSize: 13,
    fontWeight: 800,
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  btnPrimary: {
    padding: '12px 24px',
    background: 'var(--btn-primary-bg)',
    color: 'var(--btn-primary-text)',
    border: 'none',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
    boxShadow: 'var(--card-shadow)',
  },
  btnSecondary: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '12px 20px',
    background: 'var(--bg-subtle)',
    color: 'var(--text-secondary)',
    borderRadius: 10,
    textDecoration: 'none',
    fontSize: 14,
    fontWeight: 700,
    border: '1px solid var(--border-subtle)',
  },
  toast: {
    position: 'fixed',
    top: 24,
    left: '50%',
    transform: 'translateX(-50%)',
    background: '#065f46',
    color: '#ffffff',
    padding: '12px 24px',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 700,
    zIndex: 10000,
    boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
    whiteSpace: 'nowrap',
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.8)',
    backdropFilter: 'blur(6px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: 16,
  },
  modalCard: {
    maxWidth: 480,
    width: '100%',
    borderRadius: 18,
    overflow: 'hidden',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
    border: '2px solid #ef4444',
    maxHeight: '92vh',
    overflowY: 'auto',
  },
  sosCardHeader: {
    background: 'linear-gradient(135deg, #b91c1c 0%, #7f1d1d 100%)',
    padding: '16px 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    background: 'rgba(255, 255, 255, 0.2)',
    border: 'none',
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 800,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    lineHeight: 1,
  },
  bloodBadgeLarge: {
    padding: '8px 16px',
    background: '#dc2626',
    color: '#ffffff',
    borderRadius: 12,
    fontSize: 18,
    fontWeight: 900,
    letterSpacing: 1,
    flexShrink: 0,
  },
  btnLogoutFull: {
    padding: '12px 24px',
    background: '#dc2626',
    color: '#ffffff',
    border: 'none',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(220, 38, 38, 0.3)',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
  },
  sosDataBox: {
    background: 'rgba(239, 68, 68, 0.08)',
    border: '1px solid rgba(239, 68, 68, 0.25)',
    borderRadius: 12,
    padding: '16px',
  },
  btnSosCall: {
    flex: 1,
    padding: '10px',
    background: '#10b981',
    color: '#ffffff',
    borderRadius: 8,
    textDecoration: 'none',
    textAlign: 'center',
    fontSize: 13,
    fontWeight: 800,
  },
  btnSosWa: {
    flex: 1,
    padding: '10px',
    background: '#25D366',
    color: '#ffffff',
    border: 'none',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 800,
    cursor: 'pointer',
  },
  sosSmallBox: {
    background: 'var(--bg-subtle)',
    borderRadius: 10,
    padding: '12px 14px',
    border: '1px solid var(--border-subtle)',
  },
  sosSmallLabel: {
    fontSize: 11,
    color: 'var(--text-secondary)',
    fontWeight: 800,
    letterSpacing: 0.5,
  },
  sosSmallVal: {
    fontSize: 14,
    fontWeight: 800,
    color: 'var(--text-primary)',
    marginTop: 2,
  },
};

