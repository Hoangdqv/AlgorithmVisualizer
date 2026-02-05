import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import CodeEditor from './components/layouts/CodeEditor';
import NavBar from './components/NavBar';
import Home from './components/layouts/Home';
import Error from './components/layouts/Error';
import SignIn from './components/layouts/SignIn';
import SignUp from './components/layouts/SignUp';
import About from './components/layouts/About';
import ResetPassword from './components/layouts/ResetPassword';
import ConfirmReset from './components/layouts/ConfirmReset';
import AlgorithmGrid from './components/layouts/CategoryGrid';
import AlgorithmSelect from './components/layouts/AlgorithmSelect';

export default function App() {
  return (
    <AuthProvider>
      <div className="app-layout">
        <NavBar />
        <div className='container'>
          <Routes>
            <Route path="/" element={<Navigate replace to="/home" />} />
            <Route path="/home" element={<Home />} /> 
            <Route path="/algorithms" element={<AlgorithmGrid />} />
            <Route path="/editor" element={<AlgorithmSelect />} />
            <Route path="/playground" element={<CodeEditor />} />
            <Route path="/about" element={<About />} />
            <Route path="/login" element={<SignIn />} />
            <Route path="/signin" element={<SignIn />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/confirm-reset" element={<ConfirmReset />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/*" element={<Error />} />
          </Routes>
        </div>
      </div>
    </AuthProvider>
  );
}
