    // ResetPassword.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { validatePassword, validatePasswordMatch } from '../utils/credentialsValidation';
import ResetPasswordForm from './form/ResetPasswordForm';

const ResetPassword = () => {
  const navigate = useNavigate();
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [sessionValid, setSessionValid] = useState(false);

  // Check if reset session exists
  useEffect(() => {
    setSessionValid(true);
    setVerifying(false);
  }, []);
  
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
      const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
        credentials: 'include'  // Send/receive cookies (session is in HttpOnly cookie)
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
        tokenValid={sessionValid}
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
