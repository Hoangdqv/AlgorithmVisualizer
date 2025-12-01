import React from 'react'
import { Link } from 'react-router-dom'
import LoginButton from './LoginButton'

export default function NavBar() {
  return (
    <div className='navbar'>
      <header>
        <h1>My Application</h1>
      </header>
      <ul>
        <Link to='/'><li>Home</li></Link>
        <Link to='/algorithms'><li>Algorithms</li></Link>
        <Link to='/playground'><li>Code Editor</li></Link>
        <Link to='/about'><li>About</li></Link>
      </ul>
      <Link to='/login'><button>Login</button></Link>
    </div>
  )
}
