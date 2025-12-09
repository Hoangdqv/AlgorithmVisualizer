import React from 'react'
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import SignInForm from '../SignInForm';
import { isEmailEmpty, validateEmail } from '../../utils/credentialsValidation';

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
            const response = await fetch('http://localhost:5000/api/auth/forgot-password', {
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
    
  return (
    <div className='auth-container'>
        <h2>Sign In</h2>
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
  )
}