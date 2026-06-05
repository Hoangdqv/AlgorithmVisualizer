import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../../auth/useAuth';
import SignInForm from '../../auth/form/SignInForm';
import { isEmailEmpty, validateEmail } from '../../script_utils/credentialsValidation';

export default function SignIn() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(false);
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const emailIsValid = validateEmail(email);
    const emailIsEmpty = isEmailEmpty(email);

    const handleForgotPassword = async () => {
        if (emailIsEmpty){
            setError('Please enter your email to reset your password.');
            return;
        } else if (!emailIsValid) {
            setError('Please enter a valid email address.');
            return;
        }
        
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/forgot-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email })
            });
            
            const data = await response.json();
            alert(data.message || 'Password reset link will be sent to your email.');
        } catch (error) {
            setError(error.message || 'An error occurred. Please try again.');
        }
    };
    
    const handleUserSignIn = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        
        if (email.includes('@')) {
            if (!emailIsValid) {
                setError('Please enter a valid email address.');
                return;
            }
        }
        
        // Login with email (backend will handle email or username)
        const result = await login(email, password);

        if (result.success) {
            navigate('/algorithms');
        } else {
            setLoading(false);
            setError(result.error || 'Login failed. Please try again.');
        }
    };

    const handleGoogleSuccess = async (credentialResponse) => {
        setLoading(true);
        setError('');
        
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/google`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    credential: credentialResponse.credential
                })
            });

            const data = await response.json();

            if (response.ok) {
                // Manually update auth context
                window.location.href = '/algorithms';  // Force reload to update auth state
            } else {
                setError(data.error || 'Google login failed');
                setLoading(false);
            }
        } catch (error) {
            console.error('Google login error:', error);
            setError('An error occurred during Google login');
            setLoading(false);
        }
    };

    const handleGoogleError = () => {
        setError('Google login failed. Please try again.');
    };
    
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    
  return (
    <GoogleOAuthProvider clientId={googleClientId || ''}>
      <div className='auth-container'>
          <h2>Sign In</h2>
          
          {/* Google Sign In */}
          {googleClientId && (
            <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'center', colorScheme: 'light'}}>
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={handleGoogleError}
                size="large"
                text="continue_with"
                shape="rectangular"
                width="300"
                locale='en'
              />
            </div>
          )}
          
          {/* Divider */}
          {googleClientId && (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              margin: '0.5rem 0',
              color: '#666'
            }}>
              <div style={{ flex: 1, height: '1px', background: '#ddd' }}></div>
              <span style={{ padding: '0 1rem', fontSize: '0.9rem' }}>or</span>
              <div style={{ flex: 1, height: '1px', background: '#ddd' }}></div>
            </div>
          )}
          
          {/* Traditional Login */}
          <SignInForm
              email={email}
              password={password}
              onChangeEmail={setEmail}
              onChangePassword={setPassword}
              onForgotPassword={handleForgotPassword}
              onSubmit={handleUserSignIn}
              onError={error}
              loading={loading}
          />
      </div>
    </GoogleOAuthProvider>
  )
}