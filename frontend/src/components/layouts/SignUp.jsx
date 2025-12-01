import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { validateEmail, validatePasswordMatch } from '../../utils/credentialsValidation';
import SignUpForm from '../SignUpForm';

export default function SignUp() {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [passwordRetype, setPasswordRetype] = useState('');
    const [error, setError] = useState('');
    const { register } = useAuth();
    const navigate = useNavigate();

    const emailIsValid = validateEmail(email);
    const passwordMatch = validatePasswordMatch(password, passwordRetype);

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
        if (password.length < 6) {
            setError('Password must be at least 6 characters.');
            return;
        }
        if (!username.trim()) {
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
    <div className='sign-in-container'>
        <h2>Sign Up</h2>
        {error && <div className="error">{error}</div>}
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
