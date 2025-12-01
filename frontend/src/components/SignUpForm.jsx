import { Link } from "react-router-dom";

const SignUpForm = ({email, password, passwordRetype, onChangeEmail, onChangePassword, onRetypePassword, onSubmit}) => {
    return (
        <form>
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
          <button type="submit" onSubmit={onSubmit}>Sign Up</button>
          <div className='redirect-link'>Already have an account? <Link to="/login">Sign In</Link></div>
        </form>
    )
};
export default SignUpForm;