import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ScrollToTop from "./scripts/ScrollToTop";
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
import UserProfile from './components/layouts/UserProfile';
import AdminPanel from './components/layouts/AdminPanel';
import { PublicOnlyRoute, ProtectedRoute, AdminRoute } from './context/RouteGuards';

const AppRoutes = () => {
  return (
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
          <Route path="/login" element={<PublicOnlyRoute><SignIn /></PublicOnlyRoute>} />
          <Route path="/signin" element={<PublicOnlyRoute><SignIn /></PublicOnlyRoute>} />
          <Route path="/signup" element={<PublicOnlyRoute><SignUp /></PublicOnlyRoute>} />
          <Route path="/confirm-reset" element={<PublicOnlyRoute><ConfirmReset /></PublicOnlyRoute>} />
          <Route path="/reset-password" element={<PublicOnlyRoute><ResetPassword /></PublicOnlyRoute>} />
          <Route path="/profile" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />
          <Route path="/admin" element={<AdminRoute><AdminPanel /></AdminRoute>} />
          <Route path="/*" element={<Error />} />
        </Routes>
          <ScrollToTop />
      </div>
      <footer>
        <p>© 2026 Algorithm Visualization Platform</p>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
