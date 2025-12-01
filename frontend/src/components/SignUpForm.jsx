import { Link } from "react-router-dom";

const SignUpForm = ({username, email, password, passwordRetype, onChangeUsername, onChangeEmail, onChangePassword, onRetypePassword, onSubmit}) => {
    return (
        <form onSubmit={onSubmit}>
          <div>
            <label htmlFor="username">Username:</label>
            <input 
                className='input-margin-bottom' 
                type="text" 
                id="username" 
                value={username}
                name="username" 
                onChange={(e) => onChangeUsername(e.target.value)}
                required />
          </div>
          <div>
            <label htmlFor="email">Email:</label>
            <input 
                className='input-margin-bottom' 
                type="email" 
                id="email" 
                value={email}
                name="email" 
                onChange={(e) => onChangeEmail(e.target.value)}
                required />
          </div>
          <div>
            <label htmlFor="password">Password:</label>
            <input 
                className='input-margin-bottom' 
                type="password" 
                id="password" 
                value={password}
                name="password" 
                onChange={(e) => onChangePassword(e.target.value)}
                required />
          </div>
          <div>
            <label htmlFor="password-retype">Confirm Password:</label>
            <input 
                className='input-margin-bottom' 
                type="password" 
                id="password-retype" 
                value={passwordRetype}
                name="password-retype" 
                onChange={(e) => onRetypePassword(e.target.value)}
                required />
          </div>
          <button type="submit">Sign Up</button>
          <div className='redirect-link'>Already have an account? <Link to="/login">Sign In</Link></div>
        </form>
    )
};
export default SignUpForm;