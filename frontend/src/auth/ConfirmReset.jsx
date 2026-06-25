import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

const ConfirmReset = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const confirmToken = async () => {
      if (!token) {
        setError('Invalid or missing reset token');
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/confirm-reset`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
          credentials: 'include'  // Send/receive cookies
        });

        if (response.ok) {
          // Token verified and session created
          // Redirect to reset password page
          setTimeout(() => {
            navigate('/reset-password');
          }, 200);
        } else {
          const data = await response.json();
          setError(data.error || 'Failed to verify token');
          setLoading(false);
        }
      } catch (error) {
        setError(error.message || 'An error occurred. Please try again.');
        setLoading(false);
      }
    };

    confirmToken();
  }, [token, navigate]);

  return (
    <div className="auth-container">
      <div className="auth-card">
        {loading ? (
          <div className="loading-content">
            <h2>Verifying your reset link...</h2>
            <div className="spinner"></div>
            <p>Please wait while we verify your token.</p>
          </div>
        ) : (
          <div className="error-content">
            <h2>Error</h2>
            <p>{error}</p>
            <button 
              onClick={() => navigate('/login')}
              className="btn btn-primary"
            >
              Request a new reset link
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConfirmReset;
