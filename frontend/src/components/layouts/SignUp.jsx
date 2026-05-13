import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import { validateEmail, isUsernameEmpty,validatePassword, validatePasswordMatch } from '../../script_utils/credentialsValidation';
import SignUpForm from '../SignUpForm';

export default function SignUp() {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [passwordRetype, setPasswordRetype] = useState('');
    const [error, setError] = useState('');
    const [showError, setShowError] = useState(false);
    const { register } = useAuth();
    const navigate = useNavigate();

    const emailIsValid = validateEmail(email);
    const usernameIsEmpty = isUsernameEmpty(username);
    const passwordIsValid = validatePassword(password);
    const passwordMatch = validatePasswordMatch(password, passwordRetype);
    useEffect(() => {
        if (error) {
        setShowError(true);

        const timer = setTimeout(() => {
            setShowError(false);
        }, 3000);

        return () => clearTimeout(timer);
        }
    }, [error]);
    
    const handleUserSignUp = async (e) => {
        e.preventDefault();
        setError('');
        
        if(!emailIsValid) {
            setError('Please enter a valid email address.');
            return;
        }
        if (!passwordMatch) {
            setError('Your passwords do not match. Please try again.');
            return;
        }
        if (!passwordIsValid) {
            setError('Password must be at least 8 characters.');
            return;
        }
        if (usernameIsEmpty) {
            setError('Username is required.');
            return;
        }
        
        const result = await register(username, email, password);
        
        if (result.success) {
            navigate('/algorithms');
        } else {
            setError(result.error || 'Registration failed. Please try again.');
        }
    };
    
    
  return (
    <div className='auth-container'>
        <h2>Sign Up</h2>
        {showError && <div className="error-alert">{error}</div>}
        <SignUpForm
            username={username}
            email={email}
            password={password}
            passwordRetype={passwordRetype}
            onChangeUsername={setUsername}
            onChangeEmail={setEmail}
            onChangePassword={setPassword}
            onRetypePassword={setPasswordRetype}
            onSubmit={handleUserSignUp}
        />
    </div>
  )
}
