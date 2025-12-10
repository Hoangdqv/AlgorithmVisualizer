const ResetPasswordForm = ({ verifying, tokenValid, error, success, password, setPassword, confirmPassword, setConfirmPassword, loading, handleSubmit, navigate }) => {
if (verifying) {
    return (
      <div className="auth-container">
        <div className="reset-password-form">
          <div className="loading">Verifying reset link...</div>
        </div>
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div className="auth-container">
        <div className="reset-password-form">
          <p className="error-alert center">{error}</p>
          <h2> Please make a new request</h2>
          <button onClick={() => navigate('/login')} className="submit-button">
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="auth-container">
        <div className="reset-password-form">
          <h2>Password Reset Successful</h2>
          <p>Your password has been changed successfully.</p>
          <p>Redirecting to login page...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="reset-password-form">
        <h2>Reset Your Password</h2>

        {error && <div className="error-alert center">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="password">New Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter new password"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              required
              disabled={loading}
            />
          </div>

          <button type="submit" className="submit-button" disabled={loading}>
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>

        <div style={{ marginTop: '1rem', textAlign: 'center' }}>
          <button 
            onClick={() => navigate('/login')} 
            className="link-button"
            disabled={loading}
          >
            Back to Login
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordForm;