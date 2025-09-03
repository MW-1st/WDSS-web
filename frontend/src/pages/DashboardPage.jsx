import { useAuth } from '../contexts/AuthContext';
import client from "../api/client.js";
import {useNavigate} from "react-router-dom";
// 페이지 이동을 위해 react-router-dom의 useNavigate 훅을 사용할 수 있습니다.
// import { useNavigate } from 'react-router-dom';

export default function DashboardPage() {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  // 새 프로젝트 생성 버튼 클릭 시 호출될 함수
  const handleCreateProject = async () => {
    try {
        const newProjectData = {
          project_name: "새로운 프로젝트",
          format: "dsj",
          max_scene: 15,
          max_speed: 6.0,
          max_accel: 3.0,
          min_separation: 2.0
        };
        // 1. POST 요청으로 프로젝트 생성
        const response = await client.post('/projects', newProjectData);
        const projectId = response.data.project.id;

        // 2. 생성된 ID로 페이지만 이동
        navigate(`/projects/${projectId}`);
    } catch (error) {
        console.error("Project creation failed:", error);
    }
  };

  return (
    <div style={{ padding: 16 }}>
      <h2>Dashboard</h2>
      {isAuthenticated ? (
        <>
          <p>Welcome, {user.username}! You are logged in.</p>
          {/* 👇 새 프로젝트 생성 버튼 추가 */}
          <button
            onClick={handleCreateProject}
            style={{
              padding: '8px 12px',
              marginTop: '8px',
              cursor: 'pointer',
              border: '1px solid #ccc',
              borderRadius: '4px',
            }}
          >
            새 프로젝트 생성
          </button>
        </>
      ) : (
        <p>You are not logged in. Please login.</p>
      )}
    </div>
  );
}