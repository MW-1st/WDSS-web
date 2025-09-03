import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';

export default function PublicRoute({ children }) {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    // 이미 인증되었다면 대시보드로 리다이렉트
    return <Navigate to="/dashboard" replace />;
  }

  // 인증되지 않았다면 자식 컴포넌트(예: LoginPage)를 렌더링
  return children;
}