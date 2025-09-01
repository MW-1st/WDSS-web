import { createContext, useState, useContext, useEffect, useRef } from 'react';
import client from "../api/client.js";

// 1. 컨텍스트 생성
const AuthContext = createContext(null);

// 2. 컨텍스트를 제공할 프로바이더 컴포넌트 생성
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const hasChecked = useRef(false);
  useEffect(() => {
    if (hasChecked.current) return; // 이미 체크했으면 return
    hasChecked.current = true;
    const checkAuthStatus = async () => {
      try {
        // 백엔드에 사용자 정보 요청 (브라우저는 자동으로 쿠키를 함께 보냄)
        const { data } = await client.get('/auth/me');
        if (data && data.username) {
          setUser(data); // 성공 시 사용자 정보 설정
        }
      } catch (error) {
        // 요청 실패 시(예: 유효한 쿠키 없음) user는 null로 유지됨
        console.log('User not authenticated');
      } finally {
        // 확인이 끝나면 로딩 상태를 false로 변경
          setLoading(false);
      }
    };

    checkAuthStatus();
  }, []);

  // 로그인 시 호출할 함수
  const login = (userData) => {
    setUser(userData);
  };

  // 로그아웃 시 호출할 함수
  const logout = async () => {
    try {
      await client.post('/auth/logout');
    } finally {
      setUser(null);
    }
  };

  const value = { user, loading, login, logout, isAuthenticated: !!user };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}


// 3. 다른 컴포넌트에서 쉽게 컨텍스트를 사용할 수 있도록 하는 커스텀 훅
export function useAuth() {
  return useContext(AuthContext);
}