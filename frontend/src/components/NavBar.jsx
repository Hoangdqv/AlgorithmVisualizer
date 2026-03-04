import { Link } from 'react-router-dom'
import { useAuth } from '../context/useAuth'

export default function NavBar() {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className='navbar'>
      <header>
        <h1>My Application</h1>
      </header>
      <ul>
        <Link to='/home'><li>Home</li></Link>
        <Link to='/algorithms'><li>Algorithms</li></Link>
        <Link to='/playground'><li>Code Editor</li></Link>
        <Link to='/about'><li>About</li></Link>
      </ul>
      
        <>
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem'}}>
              <div>
                <span style={{ borderRadius: '5px', boxSizing: 'border-box'}}>Welcome, {user.username}!</span>
              </div>
                <a className="logout-btn" href='javascript:void(0)' onClick={handleLogout}>Logout</a>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '2rem' }}>
              <Link to='/login' className='sign-in-btn'>Login</Link>
              <Link to='/signup' className='sign-up-btn'>Sign Up</Link>
            </div>
          )}
        </>
    </div>
  )
}
