import React from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useUnity } from "../contexts/UnityContext.jsx";
import client from "../api/client";
import { getAllCanvasStates } from "../utils/indexedDBUtils";

export default function Navbar({ transparent: propTransparent = false }) {
  const location = useLocation();
  const { isAuthenticated, logout } = useAuth();
  const { isUnityVisible, showUnity, hideUnity } = useUnity();

  // ===== ① 에디터(프로젝트) 전용 Navbar =====
  if (location.pathname.startsWith("/projects")) {
    const projectId = location.pathname.split("/")[2];

    const api = typeof window !== "undefined" ? window.editorAPI : undefined;

    const [editorState, setEditorState] = React.useState(() => ({
      targetDots: api?.targetDots || 2000,
      processing: api?.processing || false,
      imageUrl: api?.imageUrl || "",
      selectedId: api?.selectedId || null,
      projectName: api?.projectName || "",
    }));

    // IndexedDB에 저장된 objectCount 합계 (현재 프로젝트의 씬만)
    const [savedObjectCount, setSavedObjectCount] = React.useState(0);
    // 씬 목록(이름 포함)과 씬별 카운트 맵
    const [projectScenes, setProjectScenes] = React.useState([]); // [{id, name, ...}]
    const [perSceneCounts, setPerSceneCounts] = React.useState({}); // { [sceneId]: count }

    const sceneId = editorState.selectedId;

    // Export prerequisites and last JSON URL
    const [jsonBuilt, setJsonBuilt] = React.useState(false);
    const [lastJsonUrl, setLastJsonUrl] = React.useState("");

    React.useEffect(() => {
      const handler = (e) => {
        const detail = e.detail || {};
        setEditorState((prev) => ({ ...prev, ...detail }));
      };
      window.addEventListener("editor:updated", handler);
      return () => window.removeEventListener("editor:updated", handler);
    }, []);

    // JSON 생성 완료 이벤트 수신
    React.useEffect(() => {
      const handler = (e) => {
        const { jsonUrl } = e.detail || {};
        if (jsonUrl) {
          console.log("JSON URL received from editor:", jsonUrl);
          setLastJsonUrl(jsonUrl);
          setJsonBuilt(true);
        }
      };
      window.addEventListener("editor:json-ready", handler);
      return () => window.removeEventListener("editor:json-ready", handler);
    }, []);

    // 현재 프로젝트에 속한 씬 목록을 서버에서 불러옴
    React.useEffect(() => {
      const loadProjectScenes = async () => {
        try {
          if (!projectId) {
            setProjectScenes([]);
            return;
          }
          const res = await client.get(`/projects/${projectId}/scenes`);
          const list = res.data?.scenes || [];
          // normalize scene objects (id and name)
          const scenes = list.map((s) => ({
            id: s.id,
            name: s.name || `Scene ${s.scene_num || ""}`,
          }));
          setProjectScenes(scenes);
        } catch (e) {
          console.warn("Failed to load project scenes for Navbar:", e);
          setProjectScenes([]);
        }
      };

      loadProjectScenes();
    }, [projectId]);

    // IndexedDB에 저장된 씬들 중 현재 프로젝트의 씬만 objectCount 합산
    const refreshSavedObjectCount = React.useCallback(async () => {
      try {
        const states = await getAllCanvasStates();
        // build per-scene map only for scenes in current project
        const ids = new Set(projectScenes.map((s) => s.id));
        const map = {};
        let total = 0;
        states.forEach((s) => {
          if (ids.has(s.sceneId)) {
            const c = s.objectCount || 0;
            map[s.sceneId] = c;
            total += c;
          }
        });
        // Ensure scenes with no saved state show 0
        projectScenes.forEach((sc) => {
          if (!map[sc.id]) map[sc.id] = 0;
        });
        setPerSceneCounts(map);
        setSavedObjectCount(total);
      } catch (err) {
        console.warn("Failed to refresh saved object count:", err);
      }
    }, [projectScenes]);

    // 실시간 반영: indexeddb 저장 이벤트 및 에디터 이벤트에 반응
    React.useEffect(() => {
      // 초기 로드
      refreshSavedObjectCount();

      const onIndexedDbSave = (e) => {
        const d = e.detail || {};
        // 프로젝트에 속한 씬에 대한 저장이면 갱신
        if (d && d.sceneId && projectScenes.find((p) => p.id === d.sceneId)) {
          refreshSavedObjectCount();
        }
      };

      const onIndexedDbDelete = (e) => {
        const d = e.detail || {};
        if (d && d.sceneId && projectScenes.find((p) => p.id === d.sceneId)) {
          // 삭제된 씬의 카운트는 0으로 처리
          refreshSavedObjectCount();
        }
      };

      const onEditorUpdated = () => refreshSavedObjectCount();
      const onJsonReady = () => refreshSavedObjectCount();

      window.addEventListener("indexeddb:canvas-saved", onIndexedDbSave);
      window.addEventListener("indexeddb:canvas-deleted", onIndexedDbDelete);
      window.addEventListener("editor:updated", onEditorUpdated);
      window.addEventListener("editor:json-ready", onJsonReady);

      return () => {
        window.removeEventListener("indexeddb:canvas-saved", onIndexedDbSave);
        window.removeEventListener(
          "indexeddb:canvas-deleted",
          onIndexedDbDelete
        );
        window.removeEventListener("editor:updated", onEditorUpdated);
        window.removeEventListener("editor:json-ready", onJsonReady);
      };
    }, [refreshSavedObjectCount]);

    const [localDots, setLocalDots] = React.useState(
      () => Number(api?.targetDots) || 2000
    );

    React.useEffect(() => {
      setLocalDots(Number(editorState.targetDots) || 2000);
    }, [editorState.targetDots]);

    const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
    const handleRangeChange = (e) => {
      const v = Number(e.target.value);
      setLocalDots(clamp(Number.isFinite(v) ? v : 2000, 100, 10000));
    };
    const commitDots = () => {
      if (!api?.setTargetDots) return;
      const safe = clamp(Number(localDots) || 2000, 100, 10000);
      api.setTargetDots(safe);
    };

    return (
      <nav className="px-4 py-2 mb-4 flex justify-center font-nanumhuman">
        <div className="w-full flex justify-between items-center gap-40">
          {/* Logo + Project name */}
          <div className="flex items-center gap-3">
            <Link
              to="/"
              title="메인 페이지"
              className="logo-press flex items-center"
            >
              <img src="/img/Logo.png" alt="Logo" className="h-10 w-auto" />
            </Link>
            <div
              className="font-extrabold text-3xl max-w-[480px] truncate"
              title={editorState.projectName || "Untitled Project"}
            >
              {editorState.projectName || "Untitled Project"}
              <span
                className="ml-3 inline-flex items-center gap-2 text-sm font-medium text-gray-800"
                title={(() => {
                  // 툴팁: 각 씬별 카운트 나열
                  try {
                    const lines = projectScenes.map((sc) => {
                      const c = perSceneCounts?.[sc.id] ?? 0;
                      return `${sc.name || sc.id}: ${c}`;
                    });
                    if (lines.length === 0) return `Total: ${savedObjectCount}`;
                    return (
                      `Selected scene: ${
                        sceneId || "-"
                      }\nTotal: ${savedObjectCount}\n` + lines.join("\n")
                    );
                  } catch (_) {
                    return `Total: ${savedObjectCount}`;
                  }
                })()}
              >
                <span className="text-base font-medium">드론 횟수 :</span>
                <span className="text-base">
                  {(() => {
                    try {
                      if (sceneId) return perSceneCounts?.[sceneId] ?? 0;
                    } catch (_) {}
                    return savedObjectCount;
                  })()}
                </span>
              </span>
            </div>
          </div>

          <div className="flex flex-1 justify-end">
            {/* Dashboard + JSON + Unity */}
            <div className="flex items-center gap-2">
              <Link
                to="/dashboard"
                className="px-3 py-1.5 rounded border border-gray-300 text-gray-800 hover:bg-gray-100"
                title="대시보드로 이동"
              >
                Dashboard
              </Link>
              <button
                onClick={async () => {
                  // EditorPage의 JSON 생성 함수 사용
                  if (api?.handleJsonGeneration) {
                    const jsonUrl = await api.handleJsonGeneration();
                    if (jsonUrl) {
                      setLastJsonUrl(jsonUrl);
                      setJsonBuilt(true);
                    }
                  } else {
                    alert("JSON 생성 기능을 사용할 수 없습니다.");
                  }
                }}
                className="px-3 py-1.5 rounded !bg-blue-600 hover:!bg-blue-700 text-white"
              >
                JSON 파일로만들기
              </button>

              <button
                onClick={() => {
                  if (!jsonBuilt || !lastJsonUrl) {
                    alert(
                      "먼저 변환을 완료하거나 'JSON 파일로만들기' 버튼을 실행해 주세요."
                    );
                    return;
                  }
                  try {
                    const a = document.createElement("a");
                    a.href = lastJsonUrl;
                    a.download = `${(
                      editorState.projectName || "project"
                    ).replace(/[^\\w.-]+/g, "_")}.json`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                  } catch (_) {
                    window.open(lastJsonUrl, "_blank", "noopener");
                  }
                }}
                className="px-3 py-1.5 rounded !bg-emerald-600 hover:!bg-emerald-700 text-white"
                title="Export"
              >
                Export
              </button>

              {!isUnityVisible ? (
                <button
                  className="px-3 py-1.5 rounded !bg-blue-600 hover:!bg-blue-700 text-white"
                  onClick={showUnity}
                >
                  Unity 시뮬레이터열기
                </button>
              ) : (
                <button
                  className="px-3 py-1.5 rounded !bg-red-600 hover:!bg-red-700 text-white"
                  onClick={hideUnity}
                >
                  Unity 시뮬레이터닫기
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>
    );
  }

  // ===== ② 일반 Navbar =====
  const routeTransparent =
    location.pathname === "/" || location.pathname === "/login";
  const transparent = propTransparent || routeTransparent;

  if (location.pathname.startsWith("/editor")) return null;

  const base =
    "w-full max-w-6xl mx-auto flex items-center justify-between px-6 py-3 font-yuniverse";

  const transparentNav =
    "fixed top-0 inset-x-0 z-50 bg-transparent backdrop-blur-md text-white";

  const solidNav =
    "sticky top-0 z-20 bg-white/80 backdrop-blur text-gray-900 shadow-sm";

  const navWrap = transparent ? transparentNav : solidNav;

  return (
    <div className={navWrap}>
      <nav className={`${base} relative flex items-center h-16 px-8 font-bold`}>
        {/* 중앙 메뉴 */}
        <div className="absolute left-1/2 -translate-x-1/2 flex gap-40 text-xl pt-1">
          <Link
            className="hover:underline underline-offset-4 decoration-2"
            to="/"
          >
            Main
          </Link>
          <Link
            className="hover:underline underline-offset-4 decoration-2"
            to=""
          >
            Introduce
          </Link>
          {!isAuthenticated && (
            <Link
              className="hover:underline underline-offset-4 decoration-2"
              to="/login"
              state={{ background: location }}
            >
              Login
            </Link>
          )}
          {isAuthenticated && (
            <Link
              className="hover:underline underline-offset-4 decoration-2"
              to="/dashboard"
            >
              Dashboard
            </Link>
          )}
        </div>

        {/* 우측 로그아웃 */}
        {isAuthenticated && (
          <div className="ml-auto">
            <button
              onClick={logout}
              className={
                transparent
                  ? "px-5 py-2 text-xl font-extrabold rounded bg-white/80 hover:bg-white transition text-transparent bg-clip-text hover:underline underline-offset-4 decoration-2 decoration-white"
                  : "px-5 py-2 text-lg rounded bg-gray-900 hover:bg-black text-white transition"
              }
            >
              Logout
            </button>
          </div>
        )}
      </nav>
    </div>
  );
}
