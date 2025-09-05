import React, { useState, useEffect } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import client from "../api/client.js";

export default function ProjectOwnerRoute({ children }) {
  const { project_id } = useParams(); // 1. URL에서 project_id 가져오기
  const { user, isAuthenticated } = useAuth(); // 2. 현재 사용자 정보 가져오기

  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    // 권한을 확인하는 비동기 함수
    const checkOwnership = async () => {
      // 먼저, 로그인 상태가 아니면 무조건 권한 없음
      if (!isAuthenticated || !user) {
        setIsAuthorized(false);
        setIsLoading(false);
        return;
      }

      try {
        // 3. API로 프로젝트 정보 요청
        const { data : {project} } = await client.get(`/projects/${project_id}`);

        // 4. 소유자 ID와 현재 사용자 ID 비교
        if (project.user_id === user.id) {
          setIsAuthorized(true);
        } else {
          setIsAuthorized(false);
        }
      } catch (error) {
        alert("프로젝트를 찾을 수 없거나 권한 확인에 실패했습니다.");
        console.error("Project not found or permission check failed:", error);
        setIsAuthorized(false); // 프로젝트가 없거나 에러 발생 시 권한 없음
      } finally {
        setIsLoading(false);
      }
    };

    checkOwnership();
  }, [project_id, user, isAuthenticated]); // 의존성 배열 설정

  // 1. 로딩 상태일 때 로딩 화면을 보여줍니다.
  if (isLoading) {
    return <div>권한을 확인하는 중입니다...</div>;
  }
  // 6. 권한에 따라 페이지를 보여주거나 리다이렉트
  return isAuthorized ? children : <Navigate to="/dashboard" replace />;
  // 권한이 없을 때 '/access-denied' 같은 전용 페이지로 보내는 것도 좋은 방법입니다.
}