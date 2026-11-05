import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import AuthLayout from '../components/AuthLayout';

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirect') ?? '/dashboard';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError('Please enter your email.');
      return;
    }

    setIsLoading(true);
    try {
      await login(cleanEmail, password);
      navigate(redirectTo);
    } catch (err: unknown) {
      const errorObj = err as { message?: string; code?: string; response?: { data?: { message?: string } } };
      if (errorObj?.message === 'Network Error' || errorObj?.code === 'ERR_NETWORK') {
        setError('Unable to reach server. Please ensure the backend is running on http://localhost:3001.');
      } else {
        const respMsg = errorObj?.response?.data?.message;
        setError(respMsg || (err instanceof Error ? err.message : 'Login failed. Please check your credentials.'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setIsGoogleLoading(true);
    try {
      const { error: googleError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });
      if (googleError) throw googleError;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Google sign-in is not configured yet in Supabase Auth.';
      setError(msg);
      setIsGoogleLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back, Rider"
      subtitle="Sign in to resume planning routes and track live group rides."
    >
      {error && (
        <div style={styles.errorBox}>
          <span style={{ fontSize: '16px' }}>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Google Sign In Button */}
      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={isGoogleLoading || isLoading}
        style={styles.googleBtn}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" style={{ marginRight: '10px' }}>
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
          />
        </svg>
        {isGoogleLoading ? 'Connecting to Google...' : 'Continue with Google'}
      </button>

      {/* Divider */}
      <div style={styles.divider}>
        <div style={styles.dividerLine} />
        <span style={styles.dividerText}>or continue with email</span>
        <div style={styles.dividerLine} />
      </div>

      <form onSubmit={handleSubmit} style={styles.form}>
        {/* Email Field */}
        <div style={styles.field}>
          <label style={styles.label}>Email Address</label>
          <div style={styles.inputWrapper}>
            <span style={styles.inputIcon}>✉️</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              style={styles.input}
            />
          </div>
        </div>

        {/* Password Field */}
        <div style={styles.field}>
          <div style={styles.passwordHeader}>
            <label style={styles.label}>Password</label>
            <Link to="/forgot-password" style={styles.forgotLink}>
              Forgot password?
            </Link>
          </div>
          <div style={styles.inputWrapper}>
            <span style={styles.inputIcon}>🔒</span>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{ ...styles.input, paddingRight: '42px' }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={styles.eyeBtn}
              title={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? '🙈' : '👁️'}
            </button>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading}
          style={isLoading ? { ...styles.submitBtn, ...styles.submitBtnDisabled } : styles.submitBtn}
        >
          {isLoading ? (
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <span>⏳</span> Signing in...
            </span>
          ) : (
            'Sign In →'
          )}
        </button>
      </form>

      <div style={styles.bottomLinkRow}>
        <span style={{ color: '#64748b', fontSize: '13.5px' }}>New to Payanam?</span>{' '}
        <Link to={redirectTo !== '/dashboard' ? `/register?redirect=${encodeURIComponent(redirectTo)}` : '/register'} style={styles.primaryLink}>
          Create an account
        </Link>
      </div>
    </AuthLayout>
  );
}

const styles: Record<string, React.CSSProperties> = {
  errorBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    color: '#b91c1c',
    borderRadius: '10px',
    padding: '12px 14px',
    fontSize: '13px',
    marginBottom: '18px',
    lineHeight: 1.45,
  },
  googleBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    padding: '11px 16px',
    background: '#ffffff',
    border: '1px solid #cbd5e1',
    borderRadius: '10px',
    fontSize: '14px',
    fontWeight: 600,
    color: '#1e293b',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
    transition: 'all 0.15s ease',
  },
  divider: {
    display: 'flex',
    alignItems: 'center',
    margin: '20px 0',
  },
  dividerLine: {
    flex: 1,
    height: '1px',
    background: '#e2e8f0',
  },
  dividerText: {
    padding: '0 12px',
    fontSize: '12px',
    color: '#94a3b8',
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '13.5px',
    fontWeight: 600,
    color: '#334155',
  },
  passwordHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  forgotLink: {
    fontSize: '12.5px',
    color: '#4f46e5',
    fontWeight: 600,
    textDecoration: 'none',
  },
  inputWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  inputIcon: {
    position: 'absolute',
    left: '12px',
    fontSize: '15px',
    color: '#94a3b8',
    pointerEvents: 'none',
  },
  input: {
    width: '100%',
    padding: '11px 14px 11px 38px',
    border: '1.5px solid #e2e8f0',
    borderRadius: '10px',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    color: '#0f172a',
    background: '#ffffff',
  },
  eyeBtn: {
    position: 'absolute',
    right: '10px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '17px',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtn: {
    marginTop: '6px',
    padding: '12.5px',
    background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '10px',
    fontSize: '15px',
    fontWeight: 700,
    boxShadow: '0 4px 14px rgba(79, 70, 229, 0.35)',
    transition: 'all 0.15s ease',
  },
  submitBtnDisabled: {
    opacity: 0.65,
    cursor: 'not-allowed',
    boxShadow: 'none',
  },
  bottomLinkRow: {
    textAlign: 'center',
    marginTop: '20px',
    fontSize: '13.5px',
  },
  primaryLink: {
    color: '#4f46e5',
    fontWeight: 700,
    textDecoration: 'none',
  },
};

export default LoginPage;
