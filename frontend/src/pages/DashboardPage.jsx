import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import client from "../api/client.js";
import { useNavigate } from "react-router-dom";
import "../styles/DashboardPage.css"; // 스타일 import
import "../styles/DashboardPage.css";
import { CiMenuBurger } from "react-icons/ci";
import { TiDelete } from "react-icons/ti";
import ProjectSettingsModal from "../components/ProjectSettingsModal";


const PlusIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <line x1="12" y1="5" x2="12" y2="19"></line>
    <line x1="5" y1="12" x2="19" y2="12"></line>
  </svg>
);

const ProjectIcon = () => (
  <svg
    width="48"
    height="48"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#e0e0e0"
    strokeWidth="1"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
    <polyline points="13 2 13 9 20 9"></polyline>
  </svg>
);

export default function DashboardPage() {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingProject, setEditingProject] = useState(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await client.get("/projects");
        setProjects(res.data.projects);
      } catch (err) {
        console.error("Failed to fetch projects:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [isAuthenticated]);

  const handleCreateProject = () => {
    setCreating(true);
  };

  const handleProjectClick = (projectId) => {
    navigate(`/projects/${projectId}`);
  };

  const openSettings = (e, project) => {
    e.stopPropagation();
    setEditingProject(project);
  };

  const closeSettings = () => setEditingProject(null);

  const handleSaved = (updated) => {
    setProjects((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
  };

  const handleDeleteProject = async (e, projectId, projectName) => {
    e.stopPropagation();
    const ok = window.confirm(`프로젝트 "${projectName}"를 삭제할까요? 이 작업은 되돌릴 수 없습니다.`);
    if (!ok) return;
    try {
      await client.delete(`/projects/${projectId}`);
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
    } catch (err) {
      console.error("Failed to delete project:", err);
      alert("프로젝트 삭제에 실패했습니다.");
    }
  };

  const formatDate = (dateString) => {
    const options = { year: "numeric", month: "long", day: "numeric" };
    return new Date(dateString).toLocaleDateString("ko-KR", options);
  };

  if (!isAuthenticated) {
    return (
      <div className="dashboard-container">
        <p>로그인이 필요합니다.</p>
      </div>
    );
  }

  return (
    <>
      <div className="dashboard-container">
        <header className="dashboard-header">
          <h2 className="welcome-message">{user.username}님 안녕하세요</h2>
          <p className="welcome-sub-message">새 작업을 시작하거나 기존 프로젝트를 확인하세요.</p>

          <div className="dashboard-actions">
            <button onClick={handleCreateProject} className="create-button">
              <PlusIcon />
              <span>새 프로젝트 생성</span>
            </button>
          </div>
        </header>

        <main className="dashboard-main">
          <section className="section">
            <h3 className="section-title">내 워크스페이스</h3>

            {loading ? (
              <p>프로젝트를 불러오는 중입니다...</p>
            ) : projects.length > 0 ? (
              <div className="project-grid">
                {projects.map((project) => (
                  <div
                    key={project.id}
                    className="project-card"
                    onClick={() => handleProjectClick(project.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) =>
                      (e.key === "Enter" || e.key === " ") && handleProjectClick(project.id)
                    }
                  >
                    {/* Hover delete button */}
                    <button
                      className="project-delete-btn"
                      title="프로젝트 삭제"
                      aria-label={`삭제: ${project.project_name}`}
                      onClick={(e) => handleDeleteProject(e, project.id, project.project_name)}
                    >
                      <TiDelete size={22} />
                    </button>
                    <div className="card-thumbnail">
                      <ProjectIcon />
                    </div>
                    <div className="card-body">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="card-title">{project.project_name}</h4>
                        <button
                          className="shrink-0 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded p-1"
                          title="프로젝트 설정"
                          onClick={(e) => openSettings(e, project)}
                          aria-label={`설정: ${project.project_name}`}
                        >
                          <CiMenuBurger size={18} />
                        </button>
                      </div>
                      <p className="card-date">생성일 {formatDate(project.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <p>아직 생성된 프로젝트가 없네요.</p>
                <p>'새 프로젝트 생성' 버튼을 눌러 프로젝트를 시작해보세요!</p>
              </div>
            )}
          </section>
        </main>
      </div>

      {editingProject && (
        <ProjectSettingsModal
          project={editingProject}
          onClose={closeSettings}
          onSaved={handleSaved}
        />
      )}
      {creating && (
        <ProjectSettingsModal
          mode="create"
          project={null}
          onClose={() => setCreating(false)}
          onSaved={(created) => {
            setProjects((prev) => [created, ...prev]);
            setCreating(false);
            navigate(`/projects/${created.id}`);
          }}
        />
      )}
    </>
  );
}
