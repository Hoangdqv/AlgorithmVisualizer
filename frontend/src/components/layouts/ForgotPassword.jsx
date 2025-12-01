import React from 'react'

export default function ForgotPassword() {
  return (
    <div className='sign-in-container'>
        <h2>Forgot Password</h2>
        <form>
          <div>
            <label htmlFor="email">Email:</label>
            <input type="email" id="email" name="email" required />
          </div>
          <button type="submit">Sign In</button>
          <div className='pwrs'>Forgot password? <a href="/forgot-password">Reset your password</a></div>
        </form>
    </div>
  )
}
