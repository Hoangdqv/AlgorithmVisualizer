import { useState } from 'react';
import { Link } from 'react-router-dom';
import { validateEmail, validatePasswordMatch } from '../../utils/credentialsValidation';
import SignUpForm from '../SignUpForm';

export default function SignIn() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [passwordRetype, setPasswordRetype] = useState('');

    const emailIsValid = validateEmail(email);
    const passwordMatch = validatePasswordMatch(password, passwordRetype);

    const handleUserSignUp = (e) => {
        e.preventDefault();
        if(!emailIsValid) {
            alert('Please enter a valid email address.');
            return;
        }
        if (!passwordMatch) {
            alert('Your passwords do not match. Please try again.');
            return;
        }
        //TODO: Add fetch request to backend to create user
    };
    
    
  return (
    <div className='sign-in-container'>
        <h2>Sign Up</h2>
        <SignUpForm
            email={email}
            password={password}
            passwordRetype={passwordRetype}
            onChangeEmail={setEmail}
            onChangePassword={setPassword}
            onRetypePassword={setPasswordRetype}
            onSubmit={handleUserSignUp}
        />
    </div>
  )
}
