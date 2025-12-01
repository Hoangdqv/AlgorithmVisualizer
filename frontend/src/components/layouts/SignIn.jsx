import React from 'react'
import { useState } from 'react';
import SignInForm from '../SignInForm';
import { isEmailEmpty, validateEmail } from '../../utils/credentialsValidation';

export default function SignIn() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const emailIsValid = validateEmail(email);
    const emailIsEmpty = isEmailEmpty(email);

    const handleForgotPassword = () => {
        if (!emailIsEmpty){
            alert('Please enter your email to reset your password.');
            return;
        } else if (!emailIsValid) {
            alert('Please enter a valid email address.');
            return;
        }
        
        fetch('/api/forgot-password', {
            method: 'POST',
            body: JSON.stringify({ email })
    })};
    
    const handleUserSignIn = (e) => {
        e.preventDefault();
        //TODO: Add fetch request to backend to sign in user
    };
    
  return (
    <div className='sign-in-container'>
        <h2>Sign In</h2>
        <SignInForm
            email={email}
            password={password}
            onChangeEmail={setEmail}
            onChangePassword={setPassword}
            onForgotPassword={handleForgotPassword}
            onSubmit={handleUserSignIn}
        />
    </div>
  )
}