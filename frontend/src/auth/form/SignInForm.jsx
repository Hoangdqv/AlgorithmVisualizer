import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';

const SignInForm = ({email, password, onChangeEmail, onChangePassword, onForgotPassword, onSubmit, onError, loading}) => {
    const [showError, setShowError] = useState(false);

  useEffect(() => {
    if (onError) {
      setShowError(true);

      const timer = setTimeout(() => {
        setShowError(false);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [onError]);

  return (
    <form onSubmit={onSubmit}>
          <div>
            <label htmlFor="email">Email:</label>
            <input 
                className='input-margin-bottom' 
                id="email" 
                value={email}
                name="email" 
                onChange={(e) => onChangeEmail(e.target.value)}
                required />
          </div>
          {showError && (
            <div className="error-alert">{onError}</div>
          )}
          <div>
            <label htmlFor="password">Password:</label>
            <input 
                className='input-no-margin-bottom' 
                type="password" 
                id="password" 
                value={password}
                name="password" 
                onChange={(e) => onChangePassword(e.target.value)}
                autoComplete='off'
                required />
          </div>
          <div className='sign-in-redirect'>
            <a href="#"  onClick={onForgotPassword}>Forgot password?</a>
          </div>
          <button type="submit" className="submit-button" disabled={loading}>
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
          <div className='redirect-link'>Don't have an account? <Link to="/signup">Sign Up</Link></div>
    </form>
  )
};
export default SignInForm;
