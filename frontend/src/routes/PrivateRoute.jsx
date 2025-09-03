import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx'; // 👈 컨텍스트 훅 import

export default function PrivateRoute({ children }) {
  const { isAuthenticated } = useAuth(); // 👈 컨텍스트에서 인증 상태 가져오기

  if (!isAuthenticated) {
    // 인증되지 않았다면 로그인 페이지로 리다이렉트
    return <Navigate to="/login" replace />;
  }

  // 인증되었다면 자식 컴포넌트(예: DashboardPage)를 렌더링
  return children;
}