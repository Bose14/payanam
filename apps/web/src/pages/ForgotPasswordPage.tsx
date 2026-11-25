import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authService } from '../services/api';
import { supabase } from '../lib/supabase';
import AuthLayout from '../components/AuthLayout';
import Icon from '../components/Icon';

function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successInfo, setSuccessInfo] = useState<{ message: string; resetLink?: string; resetToken?: string } | null>(null);

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
      // Also attempt Supabase native recovery email in case Supabase SMTP is configured
      try {
        await supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
      } catch {
        // Supabase Auth email is optional fallback
      }

      const data = await authService.forgotPassword(cleanEmail);
      setSuccessInfo(data || { message: 'Password reset authorization ready.' });
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

  const isUserNotFound = error && (error.toLowerCase().includes('no account') || error.toLowerCase().includes('not found'));
  const resetToken = successInfo?.resetToken || (successInfo?.resetLink ? successInfo.resetLink.split('token=')[1] : '');

  return (
    <AuthLayout
      title="Reset Password"
      subtitle="Enter your registered email and we'll help you securely reset your password."
    >
      {error && (
        <div style={styles.errorBox}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <span style={{ fontSize: '16px' }}><Icon name="warning" /></span>
            <div style={{ flex: 1 }}>
              <div>{error}</div>
              {isUserNotFound && (
                <div style={{ marginTop: '8px' }}>
                  <Link to="/register" style={styles.createAccountBtn}>
                    Create an account with this email →
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {successInfo ? (
        <div style={styles.successBox}>
          <div style={{ fontSize: '38px', marginBottom: '8px' }}><Icon name="lock" /></div>
          <h3 style={styles.successTitle}>Password Reset Ready!</h3>
          <p style={styles.successMessage}>
            Password reset authorization has been generated for <strong>{email}</strong>.
          </p>

          <div style={styles.actionCard}>
            <p style={{ margin: '0 0 14px', fontSize: '13.5px', color: '#1e293b', lineHeight: 1.5 }}>
              Since email delivery (SMTP) is not configured in this deployment, click below to set your new password immediately:
            </p>
            <Link
              to={resetToken ? `/reset-password?token=${resetToken}` : '/reset-password'}
              style={styles.directResetBtn}
            >
              Set New Password Now →
            </Link>
          </div>

          <div style={{ marginTop: '18px' }}>
            <Link to="/login" style={styles.backLink}>
              ← Back to Sign In
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Email Address</label>
            <div style={styles.inputWrapper}>
              <span style={styles.inputIcon}><Icon name="mail" /></span>
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
            {isLoading ? 'Generating Link...' : 'Continue to Reset Password →'}
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
  createAccountBtn: {
    display: 'inline-block',
    fontSize: '13px',
    fontWeight: 700,
    color: '#b91c1c',
    textDecoration: 'underline',
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
    borderRadius: '16px',
    padding: '24px 20px',
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
  actionCard: {
    background: '#ffffff',
    border: '1.5px solid #86efac',
    borderRadius: '12px',
    padding: '16px 14px',
    margin: '12px 0 16px',
    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.12)',
    textAlign: 'center',
  },
  directResetBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    padding: '13px 18px',
    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    color: '#ffffff',
    borderRadius: '10px',
    textDecoration: 'none',
    fontSize: '15px',
    fontWeight: 700,
    boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
    transition: 'all 0.15s ease',
    boxSizing: 'border-box',
  },
  backLink: {
    color: '#4f46e5',
    fontWeight: 600,
    fontSize: '13.5px',
    textDecoration: 'none',
  },
};

export default ForgotPasswordPage;
