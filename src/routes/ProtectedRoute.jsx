import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
export default function ProtectedRoute({ children, roles }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  const role = (user.role || user.tenVaiTro || user.vaiTro?.tenVaiTro || '').replace('ROLE_', '');
  if (roles?.length && !roles.includes(role)) return <Navigate to="/login" replace />;
  return children;
}
