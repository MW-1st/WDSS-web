import { useState, useEffect, useRef } from "react";
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
  // don't auto-load on mount; wait for user scroll
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [userScrolled, setUserScrolled] = useState(false);
  const sentinelRef = useRef(null);
  const [editingProject, setEditingProject] = useState(null);
  const [creating, setCreating] = useState(false);
  const [bannerUrl, setBannerUrl] = useState("/img/banner_01.png");
  const [thumbs, setThumbs] = useState({});
  const PAGE_SIZE = 12;

  // Pick a random banner when the dashboard mounts
  useEffect(() => {
    const candidates = [
      "/img/banner_01.png",
      "/img/banner_02.png",
      "/img/banner_03.png",
      "/img/banner_04.png",
      "/img/banner_05.png",
    ];
    const idx = Math.floor(Math.random() * candidates.length);
    setBannerUrl(candidates[idx]);
  }, []);


  // don't fetch automatically on mount — wait for the user to scroll
  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      setProjects([]);
      setOffset(0);
      setHasMore(true);
    } else {
      // authenticated but we still wait for user's scroll to load data
      setLoading(false);
    }
  }, [isAuthenticated]);

  // load more when offset changes or on explicit request
  const loadMore = async () => {
    if (pageLoading || !hasMore) return;
    setPageLoading(true);
    try {
  const res = await client.get("/projects", { params: { limit: PAGE_SIZE, offset } });
      const newItems = res.data.projects || [];
      setProjects((prev) => [...prev, ...newItems]);
      const newOffset = offset + newItems.length;
      setOffset(newOffset);
      setHasMore(newOffset < (res.data.total || 0));
    } catch (err) {
      console.error("Failed to load more projects:", err);
    } finally {
      setPageLoading(false);
    }
  };

  // initial load function (fetch first page) -- keep this so the dashboard shows projects on first render
  const loadFirst = async () => {
    // avoid clashing with pageLoading
    if (pageLoading) return;
    setLoading(true);
    try {
      const res = await client.get("/projects", { params: { limit: PAGE_SIZE, offset: 0 } });
      const items = res.data.projects || [];
      setProjects(items);
      setHasMore((res.data.total || 0) > items.length);
      setOffset(items.length);
    } catch (err) {
      console.error("Failed to fetch projects:", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch thumbnail (scene 1) for each project
  useEffect(() => {
    if (!Array.isArray(projects) || projects.length === 0) return;
    let cancelled = false;

    const run = async () => {
      const entries = await Promise.all(
        projects.map(async (p) => {
          try {
            const { data } = await client.get(`/projects/${p.id}/scenes`);
            const list = Array.isArray(data) ? data : (data?.scenes ?? []);
            if (!Array.isArray(list) || list.length === 0) return [p.id, null];

            // Prefer scene_num === 1, else min scene_num, else first
            const targetByOne = list.find((s) => s?.scene_num === 1) || null;
            let target = targetByOne;
            if (!target) {
              const withNum = list.filter((s) => typeof s?.scene_num === "number");
              if (withNum.length) {
                const minNum = Math.min(...withNum.map((s) => s.scene_num));
                target = withNum.find((s) => s.scene_num === minNum) || null;
              }
            }
            if (!target) target = list[0];

            const sceneId = target?.id;
            const url = sceneId ? `/thumbnails/${sceneId}.png` : null;
            return [p.id, url || null];
          } catch (e) {
            console.warn("Failed to load scenes for project", p.id, e?.response?.data || e?.message);
            return [p.id, null];
          }
        })
      );

      if (!cancelled) setThumbs((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [projects]);

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;

    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // only trigger loading after the user has scrolled
          if (entry.isIntersecting && hasMore && !pageLoading && userScrolled) {
            loadMore();
          }
        });
      },
      { root: null, rootMargin: "200px", threshold: 0.1 }
    );

    obs.observe(node);
    return () => obs.disconnect();
  }, [userScrolled, hasMore, pageLoading]);

  // If the page is too short to scroll (e.g. small/minimized window) and we haven't
  // received a user scroll, auto-trigger loading so content fills the viewport.
  useEffect(() => {
    try {
      if (userScrolled) return;
      const doc = document.documentElement;
      const canScroll = doc.scrollHeight > window.innerHeight;
      if (!canScroll && hasMore && !pageLoading) {
        // Allow intersection observer and other logic to run as if the user scrolled
        setUserScrolled(true);
        // Load next page to try to fill viewport
        loadMore();
      }
    } catch (e) {
      // ignore if DOM not available
    }
  }, [projects, userScrolled, hasMore, pageLoading]);

  // ensure first page is loaded when the user is authenticated (so the dashboard is not empty)
  useEffect(() => {
    if (isAuthenticated && projects.length === 0) {
      loadFirst();
    }
  }, [isAuthenticated]);

  // listen for the user's first scroll action; after that, allow intersection to trigger loads
  useEffect(() => {
    const onFirstScroll = () => {
      setUserScrolled(true);
      window.removeEventListener("scroll", onFirstScroll);

      // If the sentinel is already in view when the user scrolls, trigger a load
      const sentinel = sentinelRef.current;
      if (sentinel && hasMore && !pageLoading) {
        const rect = sentinel.getBoundingClientRect();
        if (rect.top <= window.innerHeight + 200) {
          loadMore();
        }
      }
    };

    window.addEventListener("scroll", onFirstScroll, { passive: true });
    return () => window.removeEventListener("scroll", onFirstScroll);
  }, [hasMore, pageLoading]);

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
        <div className="hero" style={{ height: 240 }}>
          <img src={bannerUrl} alt="banner" className="hero-bg" />
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
        </div>

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
                      {thumbs[project.id] ? (
                        <img
                          src={thumbs[project.id]}
                          alt={`${project.project_name} 썸네일`}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          loading="lazy"
                        />
                      ) : (
                        <ProjectIcon />
                      )}
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

                {/* sentinel for infinite scroll */}
                <div id="projects-sentinel" ref={sentinelRef} style={{ height: 1 }} />
              </div>
            ) : (
              <div className="empty-state">
                <p>아직 생성된 프로젝트가 없네요.</p>
                <p>'새 프로젝트 생성' 버튼을 눌러 프로젝트를 시작해보세요!</p>
              </div>
            )}
            {/* page loading and end message */}
            {pageLoading && <p style={{ textAlign: "center", marginTop: 12 }}>더 불러오는 중...</p>}
            {!hasMore && projects.length > 0 && <p style={{ textAlign: "center", marginTop: 12 }}>모든 프로젝트를 불러왔습니다.</p>}
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
