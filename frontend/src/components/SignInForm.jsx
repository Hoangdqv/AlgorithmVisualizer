import { Link } from 'react-router-dom';

const SignInForm = ({email, password, onChangeEmail, onChangePassword, onForgotPassword, onSubmit}) => {
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
                className='input-no-margin-bottom' 
                type="password" 
                id="password" 
                value={password}
                name="password" 
                onChange={(e) => onChangePassword(e.target.value)}
                required />
          </div>
          <div className='sign-in-redirect'>
            <a href="#" onClick={onForgotPassword}>Forgot password?</a>
          </div>
          <button type="submit" onSubmit={onSubmit}>Sign In</button>
          <div className='redirect-link'>Don't have an account? <Link to="/signup">Sign Up</Link></div>

        </form>
  )
};
export default SignInForm;
