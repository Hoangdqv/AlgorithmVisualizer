import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'

export default function NavBar() {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className='navbar'>
      <header className='navbar-header'>
        <h1>My Application</h1>
      </header>
      <ul className='navbar-links'>
        <Link to='/home'><li>Home</li></Link>
        <Link to='/algorithms'><li>Algorithms</li></Link>
        <Link to='/playground'><li>Code Editor</li></Link>
        <Link to='/about'><li>About</li></Link>
        {user && user.role === 'admin' && (
          <Link to='/admin'><li>Admin</li></Link>
        )}
      </ul>
      
        <>
          {user ? (
            <div className='navbar-auth navbar-auth-user'>
              <div>
                <span className='navbar-welcome'>Welcome, {user.username}!</span>
              </div>
              <Link to='/profile' className='sign-in-btn'>Profile</Link>
              <a className="logout-btn" href='javascript:void(0)' onClick={handleLogout}>Logout</a>
            </div>
          ) : (
            <div className='navbar-auth navbar-auth-guest'>
              <Link to='/login' className='sign-in-btn'>Login</Link>
              <Link to='/signup' className='sign-up-btn'>Sign Up</Link>
            </div>
          )}
        </>
    </div>
  )
}
