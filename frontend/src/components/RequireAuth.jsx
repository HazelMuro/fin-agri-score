import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth, useAuthBootstrap } from '../auth/AuthContext';

export default function RequireAuth() {
  const { user, authDisabled } = useAuth();
  const bootstrapped = useAuthBootstrap();
  const location = useLocation();

  if (!bootstrapped) {
    return (
      <div className="page state" style={{ minHeight: '60vh' }}>
        <div className="spinner" />
        <p style={{ marginTop: 16 }}>Loading workspace…</p>
      </div>
    );
  }

  if (authDisabled || user) {
    return <Outlet />;
  }

  return <Navigate to="/login" replace state={{ from: location }} />;
}
