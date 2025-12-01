import { useNavigate } from "react-router-dom"

export default function LoginButton() {
  const navigate = useNavigate();
  
  const handleLogin = () => {
    navigate('/login');
  }
  return (
    <button 
    onClick={handleLogin}
    className="login-btn">
        Sign in
    </button>
  )
}
