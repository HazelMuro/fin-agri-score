import { Navigate, Outlet } from 'react-router-dom';
import { useAuth, useAuthBootstrap } from '../auth/AuthContext';

export default function RequireAuth() {
  const bootstrapped = useAuthBootstrap();
  const { user } = useAuth();

  if (!bootstrapped) {
    return (
      <div className="page state" style={{ minHeight: '60vh' }}>
        <div className="spinner" />
        <p style={{ marginTop: 16 }}>Loading workspace…</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
