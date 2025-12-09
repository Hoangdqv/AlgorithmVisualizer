import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('http://localhost:5000/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
      } else {
        setError(data.error || 'Failed to send reset email');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="sign-in-container">
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', color: '#10b981', marginBottom: '1rem' }}>✓</div>
          <h2>Check Your Email</h2>
          <p style={{ marginBottom: '1rem' }}>
            If an account with <strong>{email}</strong> exists, 
            we've sent a password reset link.
          </p>
          <p style={{ color: '#888', fontSize: '14px', marginTop: '1rem' }}>
            The link will expire in 1 hour.
          </p>
          <button 
            onClick={() => navigate('/login')} 
            style={{ marginTop: '1.5rem', width: '100%' }}
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className='sign-in-container'>
      <h2>Forgot Password?</h2>
      <p style={{ color: '#888', marginBottom: '1.5rem', textAlign: 'center' }}>
        Enter your email address and we'll send you a link to reset your password.
      </p>

      {error && (
        <div style={{ 
          padding: '0.75rem', 
          marginBottom: '1rem', 
          backgroundColor: '#fee', 
          color: '#c33', 
          borderRadius: '4px',
          fontSize: '14px'
        }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="email">Email:</label>
          <input 
            type="email" 
            id="email" 
            name="email" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required 
            disabled={loading}
            placeholder="Enter your email"
          />
        </div>
        <button type="submit" disabled={loading}>
          {loading ? 'Sending...' : 'Send Reset Link'}
        </button>
        <div className='pwrs'>
          Remember your password? <a href="/login">Back to Login</a>
        </div>
      </form>
    </div>
  );
}
