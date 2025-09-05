import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import client from "../api/client.js";
import { useNavigate } from "react-router-dom";

// 아이콘을 위한 간단한 SVG 컴포넌트 (파일 상단에 추가)
const PlusIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"></line>
    <line x1="5" y1="12" x2="19" y2="12"></line>
  </svg>
);

const ProjectIcon = () => (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#e0e0e0" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
        <polyline points="13 2 13 9 20 9"></polyline>
    </svg>
);


export default function DashboardPage() {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAuthenticated) {
      const fetchProjects = async () => {
        try {
          const response = await client.get('/projects');
          setProjects(response.data.projects);
        } catch (error) {
          console.error("Failed to fetch projects:", error);
        } finally {
          setLoading(false);
        }
      };
      fetchProjects();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated]);

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
        const response = await client.post('/projects', newProjectData);
        const projectId = response.data.project.id;
        navigate(`/projects/${projectId}`);
    } catch (error) {
        console.error("Project creation failed:", error);
    }
  };

  const handleProjectClick = (projectId) => {
    navigate(`/projects/${projectId}`);
  };

  // 날짜 포맷팅 함수
  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('ko-KR', options);
  };

  if (!isAuthenticated) {
    return (
      <div style={styles.container}>
        <p>로그인이 필요합니다.</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* --- 헤더 --- */}
      <header style={styles.header}>
        <h2 style={styles.welcomeMessage}>{user.username}님, 안녕하세요!</h2>
        <p style={styles.welcomeSubMessage}>새로운 작업을 시작하거나 기존 프로젝트를 확인하세요.</p>
      </header>

      {/* --- 새 프로젝트 생성 섹션 --- */}
      <div style={styles.actions}>
        <button onClick={handleCreateProject} style={styles.createButton}>
          <PlusIcon />
          <span>새 프로젝트 생성</span>
        </button>
      </div>

      {/* --- 프로젝트 목록 섹션 --- */}
      <main style={styles.mainContent}>
        <h3 style={styles.sectionTitle}>내 워크스페이스</h3>
        {loading ? (
          <p>프로젝트를 불러오는 중입니다...</p>
        ) : projects.length > 0 ? (
          <div style={styles.projectGrid}>
            {projects.map((project) => (
              <div
                key={project.id}
                style={styles.projectCard}
                onClick={() => handleProjectClick(project.id)}
              >
                <div style={styles.cardThumbnail}>
                  <ProjectIcon />
                </div>
                <div style={styles.cardBody}>
                  <h4 style={styles.cardTitle}>{project.project_name}</h4>
                  <p style={styles.cardDate}>생성일: {formatDate(project.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={styles.emptyState}>
            <p>아직 생성된 프로젝트가 없네요.</p>
            <p>'새 프로젝트 생성' 버튼을 눌러 첫 프로젝트를 시작해보세요!</p>
          </div>
        )}
      </main>
    </div>
  );
}

// --- 스타일 객체 (CSS-in-JS) ---
const styles = {
  container: {
    padding: '24px 48px',
    fontFamily: "'Pretendard', sans-serif", // (선택) Pretendard 같은 깔끔한 폰트 추천
    backgroundColor: '#f8f9fa',
    minHeight: '100vh',
  },
  header: {
    marginBottom: '24px',
  },
  welcomeMessage: {
    fontSize: '2.25rem',
    fontWeight: '700',
    color: '#212529',
    margin: '0 0 8px 0',
  },
  welcomeSubMessage: {
    fontSize: '1rem',
    color: '#6c757d',
    margin: 0,
  },
  actions: {
    marginBottom: '40px',
  },
  createButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 24px',
    fontSize: '1rem',
    fontWeight: '600',
    color: '#fff',
    backgroundColor: '#007bff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    boxShadow: '0 4px 6px rgba(0, 123, 255, 0.1)',
    transition: 'all 0.2s ease',
  },
  mainContent: {},
  sectionTitle: {
    fontSize: '1.5rem',
    fontWeight: '600',
    color: '#343a40',
    borderBottom: '1px solid #dee2e6',
    paddingBottom: '12px',
    marginBottom: '24px',
  },
  projectGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '24px',
  },
  projectCard: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
    overflow: 'hidden',
    cursor: 'pointer',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    display: 'flex',
    flexDirection: 'column',
  },
  cardThumbnail: {
    backgroundColor: '#f1f3f5',
    height: '160px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardBody: {
    padding: '16px 20px',
    flexGrow: 1,
  },
  cardTitle: {
    fontSize: '1.1rem',
    fontWeight: '600',
    margin: '0 0 8px 0',
    color: '#212529',
  },
  cardDate: {
    fontSize: '0.875rem',
    color: '#868e96',
    margin: 0,
  },
  emptyState: {
    textAlign: 'center',
    padding: '48px',
    backgroundColor: '#fff',
    borderRadius: '12px',
    color: '#6c757d',
  }
};