import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authService } from '../services/api';
import { useAuth } from '../context/AuthContext';

type Step = 'welcome' | 'invite' | 'phone' | 'otp' | 'profile' | 'consent' | 'perms' | 'done';

const FLOW: Step[] = ['phone', 'otp', 'profile', 'consent', 'perms', 'done'];
const CITIES = ['Bengaluru', 'Mysuru', 'Mangaluru', 'Hubli', 'Kochi', 'Other'];
const INVITE_KEY = 'payanam_pending_invite';

function apiMessage(err: unknown, fallback: string): string {
  const e = err as {
    response?: {
      data?: {
        message?: string;
        error?: { message?: string } | string;
      };
    };
    message?: string;
  };
  const data = e?.response?.data;
  if (typeof data?.message === 'string') return data.message;
  if (typeof data?.error === 'object' && typeof data?.error?.message === 'string') return data.error.message;
  if (typeof data?.error === 'string') return data.error;
  if (typeof e?.message === 'string' && !e.message.startsWith('Request failed')) return e.message;
  return fallback;
}

function maskPhone(digits: string): string {
  const d = digits.replace(/\D/g, '').slice(-10);
  return d.length === 10 ? `+91 ••••• ${d.slice(6)}` : '';
}

function StepDots({ current }: { current: Step }) {
  const idx = FLOW.indexOf(current);
  return (
    <div className="pz-steps" aria-label={`Step ${idx + 1} of ${FLOW.length}`}>
      {FLOW.map((s, i) => (
        <span key={s} className={i <= idx ? 'on' : ''} />
      ))}
    </div>
  );
}

type PermState = 'unknown' | 'allowed' | 'denied';

export default function WelcomePage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user, isAuthenticated, isLoading, completeLogin, refreshUser } = useAuth();

  const [step, setStep] = useState<Step>('welcome');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const [invite, setInvite] = useState(() => sessionStorage.getItem(INVITE_KEY) || '');
  const [inviteInput, setInviteInput] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [devCode, setDevCode] = useState<string | undefined>();
  const [copied, setCopied] = useState(false);
  const [name, setName] = useState('');
  const [city, setCity] = useState('Bengaluru');
  const [bike, setBike] = useState('');
  const [consent, setConsent] = useState({ terms: false, loc: false, recognition: false });
  const [perms, setPerms] = useState<{ loc: PermState; notif: PermState; battery: PermState }>({
    loc: 'unknown',
    notif: 'unknown',
    battery: 'unknown',
  });

  const redirectTo = useMemo(() => {
    const r = params.get('redirect');
    return r && r.startsWith('/') && !r.startsWith('//') ? r : null;
  }, [params]);

  // Where to land once onboarding is finished.
  const destination = () => {
    const pending = sessionStorage.getItem(INVITE_KEY);
    if (pending) {
      sessionStorage.removeItem(INVITE_KEY);
      return `/join/${encodeURIComponent(pending)}`;
    }
    return redirectTo || '/ride';
  };

  // Already signed in: finished users go to the app; unfinished ones resume at their profile.
  useEffect(() => {
    if (isLoading || !isAuthenticated || !user) return;
    if (user.onboardingComplete === false) {
      setName((n) => n || user.fullName || '');
      setStep((s) => (s === 'welcome' || s === 'phone' || s === 'otp' || s === 'invite' ? 'profile' : s));
    } else if (step !== 'perms' && step !== 'done') {
      navigate(destination(), { replace: true });
    }
  }, [isLoading, isAuthenticated, user]);

  const go = (s: Step) => {
    setErr('');
    setStep(s);
  };

  const submitInvite = () => {
    const code = inviteInput.trim().toUpperCase();
    if (code.length < 4) {
      setErr('Enter the code your captain gave you.');
      return;
    }
    sessionStorage.setItem(INVITE_KEY, code);
    setInvite(code);
    go('phone');
  };

  const sendCode = async () => {
    setErr('');
    const cleaned = phone.replace(/[^\d]/g, '');
    const ten = cleaned.length === 12 && cleaned.startsWith('91') ? cleaned.slice(2) : cleaned;
    if (!/^[6-9]\d{9}$/.test(ten)) {
      setErr('Enter a valid 10-digit Indian mobile number (e.g. 98765 43210).');
      return;
    }
    setBusy(true);
    try {
      const res = await authService.requestPhoneCode(phone);
      if (!res.devCode) {
        setErr('The server did not return a code. Update the API to the latest version and try again.');
        return;
      }
      setDevCode(res.devCode);
      setOtp('');
      setStep('otp');
    } catch (e) {
      setErr(apiMessage(e, 'Could not send the code. Check the number and try again.'));
    } finally {
      setBusy(false);
    }
  };

  const copyCode = async () => {
    if (!devCode) return;
    try {
      await navigator.clipboard.writeText(devCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked: the code is still on screen */
    }
  };

  const verify = async () => {
    setErr('');
    if (!/^\d{4}$/.test(otp.trim())) {
      setErr('Enter the 4-digit verification code.');
      return;
    }
    setBusy(true);
    try {
      const res = await authService.verifyPhoneCode(phone, otp.trim());
      completeLogin(res);
      setName(res.user.fullName || '');
      if (res.user.city) setCity(res.user.city);
      if (res.user.bike) setBike(res.user.bike);
      setStep(res.user.onboardingComplete === false ? 'profile' : 'done');
    } catch (e) {
      setErr(apiMessage(e, 'That code is not right. Check it and try again.'));
    } finally {
      setBusy(false);
    }
  };

  const saveProfile = () => {
    if (name.trim().length < 2) {
      setErr('Enter your name as riders should see it.');
      return;
    }
    go('consent');
  };

  const saveConsent = async () => {
    setErr('');
    setBusy(true);
    try {
      await authService.completeOnboarding({
        fullName: name.trim(),
        city,
        bike: bike.trim() || undefined,
        termsAccepted: consent.terms,
        locationConsent: consent.loc,
        recognitionOptIn: consent.recognition,
      });
      await refreshUser();
      setStep('perms');
    } catch (e) {
      setErr(apiMessage(e, 'Could not save your choices. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  const askLocation = () => {
    if (!('geolocation' in navigator)) {
      setPerms((p) => ({ ...p, loc: 'denied' }));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      () => setPerms((p) => ({ ...p, loc: 'allowed' })),
      () => setPerms((p) => ({ ...p, loc: 'denied' })),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  const askNotifications = async () => {
    if (!('Notification' in window)) {
      setPerms((p) => ({ ...p, notif: 'denied' }));
      return;
    }
    const result = await Notification.requestPermission();
    setPerms((p) => ({ ...p, notif: result === 'granted' ? 'allowed' : 'denied' }));
  };

  const pill = (s: PermState) => (
    <span className={`pz-pill ${s === 'allowed' ? 'ok' : s === 'denied' ? 'warn' : 'stale'}`}>
      {s === 'allowed' ? 'Allowed' : s === 'denied' ? 'Blocked' : 'Not yet'}
    </span>
  );

  const toggle = (key: 'terms' | 'loc' | 'recognition', title: string, note: string, required?: boolean) => (
    <div className="pz-setting">
      <div className="pz-grow">
        <b>
          {title}
          {required && <span className="pz-tag">Required</span>}
        </b>
        <div className="pz-note">{note}</div>
      </div>
      <button
        className="pz-switch"
        type="button"
        role="switch"
        aria-label={title}
        aria-checked={consent[key]}
        onClick={() => setConsent((c) => ({ ...c, [key]: !c[key] }))}
      />
    </div>
  );

  const errorLine = err && (
    <p role="alert" style={{ color: 'var(--pz-bad)', fontSize: 13, margin: '8px 0 0' }}>
      {err}
    </p>
  );

  return (
    <div className="pz-shell">
      <header className="pz-top">
        <div className="pz-brand">Payanam</div>
        <div className="pz-grow pz-ctx">Welcome</div>
      </header>
      <main className="pz-main">
        {step === 'welcome' && (
          <div style={{ paddingTop: 26 }}>
            <h1 className="pz-h1" style={{ fontSize: 40 }}>Payanam</h1>
            <p style={{ fontSize: 17, margin: '0 0 22px' }}>Ride together. Stay together.</p>
            <p className="pz-note" style={{ marginBottom: 26 }}>
              Track your group on the road, agree stops in one tap, and keep the trip plan in one place.
            </p>
            <button className="pz-btn primary block" type="button" onClick={() => go('phone')}>
              Get started
            </button>
            <button className="pz-btn block" type="button" onClick={() => go('invite')}>
              I have an invite code
            </button>
            <p className="pz-note" style={{ marginTop: 18 }}>
              Already use an email and password?{' '}
              <Link to={redirectTo ? `/login?redirect=${encodeURIComponent(redirectTo)}` : '/login'} style={{ color: 'var(--pz-sys)' }}>
                Sign in with email
              </Link>
            </p>
          </div>
        )}

        {step === 'invite' && (
          <>
            <h2 className="pz-h2">Join with invite code</h2>
            <p className="pz-note">Ask your captain for the code. It adds you to their trip after you sign in.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, marginTop: 12 }}>
              <input
                className="pz-input"
                placeholder="e.g. KSD-7Q2"
                aria-label="Invite code"
                value={inviteInput}
                onChange={(e) => setInviteInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitInvite()}
                style={{ textTransform: 'uppercase' }}
              />
              <button className="pz-btn primary" type="button" onClick={submitInvite}>Join</button>
            </div>
            {errorLine}
            <button className="pz-btn block" type="button" onClick={() => go('welcome')} style={{ marginTop: 14 }}>Back</button>
          </>
        )}

        {step === 'phone' && (
          <>
            <StepDots current="phone" />
            <h2 className="pz-h2">Your mobile number</h2>
            <p className="pz-note">
              We send a one-time code by SMS to confirm it is you. Used for sign-in and trip invites. Never shown to other riders.
            </p>
            {invite && (
              <div className="pz-banner ok" role="status" style={{ marginTop: 12 }}>
                Invite {invite} saved. You join the trip after sign-in.
              </div>
            )}
            <label className="pz-label" htmlFor="pz-phone" style={{ marginTop: 12, display: 'block' }}>Mobile number</label>
            <div style={{ display: 'grid', gridTemplateColumns: '64px 1fr', gap: 8 }}>
              <div className="pz-input" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}>+91</div>
              <input
                id="pz-phone"
                className="pz-input"
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                placeholder="98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !busy && sendCode()}
              />
            </div>
            {errorLine || <p className="pz-note" style={{ margin: '8px 0 0' }}>Type your 10-digit number. Spaces and +91 are fine.</p>}
            <button className="pz-btn primary block" type="button" onClick={sendCode} disabled={busy} style={{ marginTop: 12 }}>
              {busy ? 'Sending…' : 'Send code'}
            </button>
            <button className="pz-btn block" type="button" onClick={() => go('welcome')}>Back</button>
          </>
        )}

        {step === 'otp' && (
          <>
            <StepDots current="otp" />
            <h2 className="pz-h2">Enter the code</h2>
            <p className="pz-note">Sent to {maskPhone(phone)}.</p>
            {devCode && (
              <div className="pz-banner warn" role="status" style={{ marginTop: 12 }}>
                <div className="pz-note" style={{ marginBottom: 6 }}>Your code (shown here instead of an SMS)</div>
                <div className="pz-row" style={{ justifyContent: 'space-between' }}>
                  <span className="pz-mono" style={{ fontSize: 24, fontWeight: 700, letterSpacing: '0.2em' }}>{devCode}</span>
                  <span className="pz-row">
                    <button className="pz-btn small" type="button" onClick={copyCode}>{copied ? 'Copied' : 'Copy'}</button>
                    <button className="pz-btn small primary" type="button" onClick={() => setOtp(devCode)}>Fill it in</button>
                  </span>
                </div>
              </div>
            )}
            <input
              className="pz-input pz-otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={4}
              placeholder="4-digit code"
              aria-label="One-time code"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              onKeyDown={(e) => e.key === 'Enter' && otp.length === 4 && !busy && verify()}
              style={{ marginTop: 12 }}
            />
            {errorLine}
            <button className="pz-btn primary block" type="button" onClick={verify} disabled={busy || otp.length !== 4} style={{ marginTop: 12 }}>
              {busy ? 'Checking…' : 'Verify'}
            </button>
            <div className="pz-row" style={{ justifyContent: 'space-between' }}>
              <button className="pz-btn small" type="button" onClick={() => go('phone')}>Change number</button>
              <button className="pz-btn small" type="button" onClick={sendCode} disabled={busy}>Resend code</button>
            </div>
          </>
        )}

        {step === 'profile' && (
          <>
            <StepDots current="profile" />
            <h2 className="pz-h2">About you</h2>
            <p className="pz-note">Riders see your name and city on the trip. Bike is optional.</p>
            <label className="pz-label" htmlFor="pz-name" style={{ marginTop: 14, display: 'block' }}>Full name</label>
            <input id="pz-name" className="pz-input" placeholder="As you want riders to see you" value={name} onChange={(e) => setName(e.target.value)} style={{ marginBottom: 12 }} />
            <label className="pz-label" htmlFor="pz-city" style={{ display: 'block' }}>Home city</label>
            <select id="pz-city" className="pz-input" value={city} onChange={(e) => setCity(e.target.value)} style={{ marginBottom: 12 }}>
              {CITIES.map((c) => <option key={c}>{c}</option>)}
            </select>
            <label className="pz-label" htmlFor="pz-bike" style={{ display: 'block' }}>Bike (optional)</label>
            <input id="pz-bike" className="pz-input" placeholder="e.g. 350 cc cruiser" value={bike} onChange={(e) => setBike(e.target.value)} style={{ marginBottom: 14 }} />
            {errorLine}
            <button className="pz-btn primary block" type="button" onClick={saveProfile} style={{ marginTop: 8 }}>Continue</button>
          </>
        )}

        {step === 'consent' && (
          <>
            <StepDots current="consent" />
            <h2 className="pz-h2">Your privacy choices</h2>
            <p className="pz-note">Payanam collects only what the app needs. You can download or delete your data at any time from Me.</p>
            <div className="pz-card" style={{ marginTop: 12 }}>
              {toggle('terms', 'Terms and Privacy Policy', 'I have read and agree to the Terms and the Privacy Policy.', true)}
              {toggle('loc', 'Location during trips', 'Your position is shared only with members of the trips you join, and only while a trip is active. Your home start point is never shared.', true)}
              {toggle('recognition', 'Show me in monthly recognition', 'Off by default. Lets your distance appear in the city rankings.')}
            </div>
            {errorLine}
            <button className="pz-btn primary block" type="button" onClick={saveConsent} disabled={busy || !consent.terms || !consent.loc}>
              {busy ? 'Saving…' : 'Agree and continue'}
            </button>
            <button className="pz-btn block" type="button" onClick={() => go('profile')}>Back</button>
          </>
        )}

        {step === 'perms' && (
          <>
            <StepDots current="perms" />
            <h2 className="pz-h2">Allow permissions</h2>
            <p className="pz-note" style={{ marginBottom: 12 }}>
              Each one explains why Payanam needs it. You can change these later in your phone or browser settings.
            </p>
            <div className="pz-card">
              <div className="pz-row" style={{ justifyContent: 'space-between' }}><b>Location</b>{pill(perms.loc)}</div>
              <p className="pz-note" style={{ margin: '8px 0 10px' }}>
                Keeps your position on the group map during a trip. You choose when a trip starts, and you can stop it anytime.
              </p>
              <button className="pz-btn small" type="button" onClick={askLocation}>Allow</button>
            </div>
            <div className="pz-card">
              <div className="pz-row" style={{ justifyContent: 'space-between' }}><b>Notifications</b>{pill(perms.notif)}</div>
              <p className="pz-note" style={{ margin: '8px 0 10px' }}>
                For stops, regroup calls and captain announcements, so you hear them with the phone in a pocket.
              </p>
              <button className="pz-btn small" type="button" onClick={askNotifications}>Allow</button>
            </div>
            <div className="pz-card">
              <div className="pz-row" style={{ justifyContent: 'space-between' }}><b>Battery settings (Android)</b>{pill(perms.battery)}</div>
              <p className="pz-note" style={{ margin: '8px 0 10px' }}>
                Some phones close apps to save battery, which stops tracking. Set Payanam to unrestricted battery use in your phone settings, then mark it done here.
              </p>
              <button className="pz-btn small" type="button" onClick={() => setPerms((p) => ({ ...p, battery: 'allowed' }))}>I have done this</button>
            </div>
            {perms.loc !== 'allowed' && (
              <div className="pz-banner warn" role="status">Without location, the group sees your position as unknown.</div>
            )}
            <button className="pz-btn primary block" type="button" onClick={() => go('done')}>Continue</button>
          </>
        )}

        {step === 'done' && (
          <>
            <StepDots current="done" />
            <div style={{ textAlign: 'center', paddingTop: 20 }}>
              <div className="pz-av big cap" style={{ margin: '0 auto 12px' }}>{(name || user?.fullName || 'R').charAt(0).toUpperCase()}</div>
              <h1 className="pz-h1">You are in, {(name || user?.fullName || 'rider').split(' ')[0]}</h1>
              <p className="pz-note">
                {city} · {maskPhone(phone || user?.phone || '')}
                {sessionStorage.getItem(INVITE_KEY) ? ' · Joining your invited trip' : ''}
              </p>
            </div>
            <button className="pz-btn primary block" type="button" onClick={() => navigate(destination(), { replace: true })} style={{ marginTop: 24 }}>
              Open Payanam
            </button>
          </>
        )}
      </main>
    </div>
  );
}
