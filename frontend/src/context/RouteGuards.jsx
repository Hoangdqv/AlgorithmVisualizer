import { Navigate } from 'react-router-dom';
import { useAuth } from './useAuth';

const RouteLoading = () => {
  return (
    <div style={{ padding: '1rem', color: '#aaa' }}>
      Checking session...
    </div>
  );
};

export const PublicOnlyRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) return <RouteLoading />;
  if (user) return <Navigate to="/profile" replace />;

  return children;
};

export const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) return <RouteLoading />;
  if (!user) return <Navigate to="/login" replace />;

  return children;
};

export const AdminRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) return <RouteLoading />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/home" replace />;

  return children;
};
