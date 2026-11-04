import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authService } from '../services/api';
import AuthLayout from '../components/AuthLayout';

function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successInfo, setSuccessInfo] = useState<{ message: string; resetLink?: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError('Please enter your email address.');
      return;
    }

    setIsLoading(true);
    try {
      const data = await authService.forgotPassword(cleanEmail);
      setSuccessInfo(data || { message: 'Password reset link generated.' });
    } catch (err: unknown) {
      const errorObj = err as { message?: string; code?: string; response?: { data?: { message?: string } } };
      if (errorObj?.message === 'Network Error' || errorObj?.code === 'ERR_NETWORK') {
        setError('Unable to reach server. Please ensure the backend is running on http://localhost:3001.');
      } else {
        const respMsg = errorObj?.response?.data?.message;
        setError(respMsg || (err instanceof Error ? err.message : 'Failed to send reset link. Please try again.'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Reset Password"
      subtitle="Enter your registered email and we'll send you instructions to reset your password."
    >
      {error && (
        <div style={styles.errorBox}>
          <span style={{ fontSize: '16px' }}>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {successInfo ? (
        <div style={styles.successBox}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>📬</div>
          <h3 style={styles.successTitle}>Request Processed!</h3>
          <p style={styles.successMessage}>{successInfo.message}</p>

          {successInfo.resetLink && (
            <div style={styles.devLinkBox}>
              <span style={styles.devBadge}>Development Mode</span>
              <p style={{ margin: '6px 0 10px', fontSize: '13px', color: '#1e3a8a' }}>
                Click below to proceed directly to the reset page:
              </p>
              <Link to={successInfo.resetLink.replace(/^https?:\/\/[^/]+/, '')} style={styles.devLinkBtn}>
                Reset Password Now →
              </Link>
            </div>
          )}

          <Link to="/login" style={styles.backLink}>
            ← Back to Sign In
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={styles.form}>
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

          <button
            type="submit"
            disabled={isLoading}
            style={isLoading ? { ...styles.submitBtn, ...styles.submitBtnDisabled } : styles.submitBtn}
          >
            {isLoading ? 'Generating Link...' : 'Send Reset Link →'}
          </button>

          <div style={{ textAlign: 'center', marginTop: '16px' }}>
            <Link to="/login" style={styles.backLink}>
              ← Back to Sign In
            </Link>
          </div>
        </form>
      )}
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
    color: '#0f172a',
    background: '#ffffff',
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
  successBox: {
    background: '#f0fdf4',
    border: '1px solid #bbf7d0',
    borderRadius: '12px',
    padding: '24px',
    textAlign: 'center',
  },
  successTitle: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#166534',
    margin: '0 0 8px',
  },
  successMessage: {
    color: '#374151',
    fontSize: '14px',
    lineHeight: 1.5,
    margin: '0 0 16px',
  },
  devLinkBox: {
    background: '#eff6ff',
    border: '1px solid #bfdbfe',
    borderRadius: '8px',
    padding: '12px',
    marginBottom: '16px',
    textAlign: 'center',
  },
  devBadge: {
    background: '#3b82f6',
    color: '#ffffff',
    fontSize: '11px',
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: '4px',
    textTransform: 'uppercase',
  },
  devLinkBtn: {
    display: 'inline-block',
    padding: '8px 16px',
    background: '#1d4ed8',
    color: '#ffffff',
    borderRadius: '6px',
    textDecoration: 'none',
    fontSize: '13.5px',
    fontWeight: 600,
  },
  backLink: {
    color: '#4f46e5',
    fontWeight: 600,
    fontSize: '13.5px',
    textDecoration: 'none',
  },
};

export default ForgotPasswordPage;
