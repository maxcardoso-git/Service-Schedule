import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

export function ProtectedRoute({ roles }) {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (roles && roles.length > 0 && user && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
