import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import ScrollToTop from "./utils/ScrollToTop";
import CodeEditor from './pages/CodeEditor';
import NavBar from './components/NavBar';
import Home from './pages/Home';
import Error from './pages/Error';
import SignIn from './pages/SignIn';
import SignUp from './pages/SignUp';
import About from './pages/About';
import ResetPassword from './auth/ResetPassword';
import ConfirmReset from './auth/ConfirmReset';
import AlgorithmGrid from './pages/CategoryGrid';
import AlgorithmSelect from './pages/AlgorithmSelect';
import UserProfile from './pages/UserProfile';
import AdminPanel from './pages/AdminPanel';
import { PublicOnlyRoute, ProtectedRoute, AdminRoute } from './auth/RouteGuards';

const AppRoutes = () => {
  return (
    <div className="app-layout hidden-scrollbar">
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
