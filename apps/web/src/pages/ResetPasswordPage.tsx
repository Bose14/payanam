import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { authService } from '../services/api';
import AuthLayout from '../components/AuthLayout';

function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Invalid or missing password reset token. Please request a new link.');
    }
  }, [token]);

  const hasLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const isFormValid = hasLength && hasUpper && hasLower && hasNumber && passwordsMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('Missing reset token. Please request a new password reset link.');
      return;
    }
    if (!hasLength) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (!hasUpper || !hasLower || !hasNumber) {
      setError('Password must contain at least one uppercase letter, one lowercase letter, and one number.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      await authService.resetPassword(token, password);
      setSuccess(true);
    } catch (err: unknown) {
      const errorObj = err as { message?: string; code?: string; response?: { data?: { message?: string } } };
      if (errorObj?.message === 'Network Error' || errorObj?.code === 'ERR_NETWORK') {
        setError('Unable to reach server. Please ensure the backend is running on http://localhost:3001.');
      } else {
        const respMsg = errorObj?.response?.data?.message;
        setError(respMsg || (err instanceof Error ? err.message : 'Failed to reset password. Please try again.'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Create New Password"
      subtitle="Enter a strong, secure password for your rider account."
    >
      {error && (
        <div style={styles.errorBox}>
          <span style={{ fontSize: '16px' }}>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {success ? (
        <div style={styles.successBox}>
          <div style={{ fontSize: '36px', marginBottom: '8px' }}>🎉</div>
          <h3 style={styles.successTitle}>Password Updated!</h3>
          <p style={styles.successMessage}>
            Your password has been reset successfully. You can now sign in with your new credentials.
          </p>
          <button onClick={() => navigate('/login')} style={styles.submitBtn}>
            Sign In to Your Account →
          </button>
        </div>
      ) : !token ? (
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '20px' }}>
            No reset token found in the URL. Please request a new reset link.
          </p>
          <Link to="/forgot-password" style={styles.submitBtn}>
            Request Reset Link
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>New Password</label>
            <div style={styles.inputWrapper}>
              <span style={styles.inputIcon}>🔒</span>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter new password"
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

          <div style={styles.field}>
            <label style={styles.label}>Confirm New Password</label>
            <div style={styles.inputWrapper}>
              <span style={styles.inputIcon}>🔒</span>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                required
                style={styles.input}
              />
            </div>
          </div>

          {/* Checklist */}
          <div style={styles.checklist}>
            <div style={hasLength ? styles.checkItemOk : styles.checkItem}>
              <span>{hasLength ? '✓' : '•'}</span> At least 8 characters
            </div>
            <div style={hasUpper ? styles.checkItemOk : styles.checkItem}>
              <span>{hasUpper ? '✓' : '•'}</span> At least 1 uppercase letter (A-Z)
            </div>
            <div style={hasLower ? styles.checkItemOk : styles.checkItem}>
              <span>{hasLower ? '✓' : '•'}</span> At least 1 lowercase letter (a-z)
            </div>
            <div style={hasNumber ? styles.checkItemOk : styles.checkItem}>
              <span>{hasNumber ? '✓' : '•'}</span> At least 1 number (0-9)
            </div>
            {confirmPassword.length > 0 && (
              <div style={passwordsMatch ? styles.checkItemOk : styles.checkItemError}>
                <span>{passwordsMatch ? '✓' : '✗'}</span> Passwords match
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading || !isFormValid}
            style={isLoading || !isFormValid ? { ...styles.submitBtn, ...styles.submitBtnDisabled } : styles.submitBtn}
          >
            {isLoading ? 'Resetting Password...' : 'Reset Password →'}
          </button>

          <div style={{ textAlign: 'center', marginTop: '14px' }}>
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
  checklist: {
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    padding: '10px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
    fontSize: '12px',
  },
  checkItem: {
    color: '#64748b',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  checkItemOk: {
    color: '#16a34a',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  checkItemError: {
    color: '#dc2626',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  submitBtn: {
    display: 'inline-block',
    textAlign: 'center',
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
    width: '100%',
    boxSizing: 'border-box',
    cursor: 'pointer',
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
    margin: '0 0 20px',
  },
  backLink: {
    color: '#4f46e5',
    fontWeight: 600,
    fontSize: '13.5px',
    textDecoration: 'none',
  },
};

export default ResetPasswordPage;
