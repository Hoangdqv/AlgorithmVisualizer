    // ResetPassword.jsx
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { validatePassword, validatePasswordMatch } from '../../utils/credentialsValidation';
import ResetPasswordForm from '../ResetPasswordForm';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [tokenValid, setTokenValid] = useState(false);

  const verifyToken = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:5000/api/auth/verify-reset-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });

      if (response.ok) {
        setTokenValid(true);
      } else {
        const data = await response.json();
        setError(data.error || 'Invalid or expired token');
      }
    } catch (error) {
      setError(error.message || 'Failed to verify token. Please try again.');
    } finally {
      setVerifying(false);
    }
  }, [token]);

    // Verify token on component mount
  useEffect(() => {
    if (!token) {
      setError('Invalid or missing reset token');
      setVerifying(false);
      return;
    }

    verifyToken();
  }, [token, verifyToken]);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!validatePassword(password)) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (!validatePasswordMatch(password, confirmPassword)) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('http://localhost:5000/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password })
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
        setTimeout(() => {
          navigate('/login');
        }, 2500);
      } else {
        setError(data.error || 'Failed to reset password');
      }
    } catch (error) {
      setError(error.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  return (
      <ResetPasswordForm
        verifying={verifying}
        tokenValid={tokenValid}
        error={error}
        success={success}
        password={password}
        setPassword={setPassword}
        confirmPassword={confirmPassword}
        setConfirmPassword={setConfirmPassword}
        loading={loading}
        handleSubmit={handleSubmit}
        navigate={navigate}
      />
  );
};

export default ResetPassword;
