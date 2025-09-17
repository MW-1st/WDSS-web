import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useUnity } from "../contexts/UnityContext.jsx";
import client from "../api/client";
import { ImExit } from "react-icons/im";
import { FaFileExport } from "react-icons/fa6";
import { FaRegCirclePlay } from "react-icons/fa6";
import { getAllCanvasStates } from "../utils/indexedDBUtils";
import ResponsiveProjectTitle from "./ResponsiveProjectTitle.jsx";


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
      projectName: api?.projectName || "Untitled Project",
      isTransformed: false,
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
        setEditorState((prev) => ({
          ...prev,
          ...detail,
          isTransformed: detail.isTransformed !== undefined ? detail.isTransformed : prev.isTransformed
        }));
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
    const loadProjectScenes = React.useCallback(async () => {
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
      }, [projectId]);

    // IndexedDB에 저장된 씬들 중 현재 프로젝트의 씬만 objectCount 합산
    const refreshSavedObjectCount = React.useCallback(async () => {
      try {
        if (!projectScenes || projectScenes.length === 0) {
          console.log('Project scenes not loaded yet, skipping refresh');
          return;
        }

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
        refreshSavedObjectCount();
      };

      const onIndexedDbDelete = (e) => {
        refreshSavedObjectCount();
      };
      const onTransformComplete = (e) => {
        console.log('Transform complete event received:', e.detail);
        refreshSavedObjectCount();
      };

      const onSceneCreated = async (e) => {
        await loadProjectScenes();
        setTimeout(() => refreshSavedObjectCount(), 200);
      };

      const onEditorUpdated = () => refreshSavedObjectCount();
      const onJsonReady = () => refreshSavedObjectCount();

      window.addEventListener("indexeddb:canvas-saved", onIndexedDbSave);
      window.addEventListener("indexeddb:canvas-deleted", onIndexedDbDelete);
      window.addEventListener("editor:transform-complete", onTransformComplete); // 추가
      window.addEventListener("editor:scene-changed", onSceneCreated); // 추가
      window.addEventListener("editor:updated", onEditorUpdated);
      window.addEventListener("editor:json-ready", onJsonReady);

      return () => {
        window.removeEventListener("indexeddb:canvas-saved", onIndexedDbSave);
        window.removeEventListener("indexeddb:canvas-deleted", onIndexedDbDelete);
        window.removeEventListener("editor:transform-complete", onTransformComplete); // 추가
        window.removeEventListener("editor:scene-changed", onSceneCreated); // 추가
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
    
    React.useEffect(() => {
      loadProjectScenes();
    }, [loadProjectScenes]);

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
      <nav className="h-14 px-4 flex items-center font-nanumhuman bg-white shadow-sm relative border-b border-gray-200">
        <div className="w-full flex justify-between items-center">
          {/* Left side */}
          <div className="flex items-center gap-4">
            <Link
              to="/"
              title="메인 페이지"
              className="logo-press flex items-center"
            >
              <img src="/img/Logo.png" alt="Logo" className="h-10 w-auto" />
            </Link>
            
            <span
                className="inline-flex items-center gap-2 text-sm font-medium text-gray-800"
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
                <span className="text-sm font-medium">드론 개수 </span>
              <span className="bg-gray-200 text-gray-900 px-2 py-0.5 rounded-full text-sm font-bold">
                {(() => {
                  try {
                    if (sceneId) return perSceneCounts?.[sceneId] ?? 0;  // ✅ 현재 씬만 카운트
                  } catch (_) {}
                  return savedObjectCount;  // 씬 없으면 전체 합계
                })()}
              </span>

            </span>

            <div className="flex items-center gap-2">
               <button
                onClick={() => api?.undo?.()}
                disabled={!api?.canUndo || api?.isProcessing}
                className="
                  w-8 h-8 flex items-center justify-center rounded-3xl
                  hover:bg-gray-200
                  active:bg-gray-300 active:scale-95
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transition-colors duration-150
                "
                title="실행 취소 (Ctrl+Z)"
              >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/>
                    </svg>
                </button>
                <button
                    onClick={() => api?.redo?.()}
                    disabled={!api?.canRedo || api?.isProcessing}
                    className="
                  w-8 h-8 flex items-center justify-center rounded-3xl
                  hover:bg-gray-200
                  active:bg-gray-300 active:scale-95
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transition-colors duration-150
                "
                    title="다시 실행 (Ctrl+Shift+Z)"
                >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.05-5.5 7.6-5.5 1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z"/>
                    </svg>
                </button>
            </div>
          </div>

          {/* Center: Project Name */}
          <div className="absolute left-1/2 -translate-x-1/2 w-2/5 px-4">
            <ResponsiveProjectTitle
              title={editorState.projectName}
              className="font-semibold text-xl text-center w-full"
            />
          </div>

          {/* Right side: JSON + Unity Controls */}
          <div className="flex items-center gap-3">
            <div className="relative group">
               <button
                  onClick={async () => {
                    let url = lastJsonUrl;
                    // If no JSON generated yet, try to generate via editor API
                    if (!jsonBuilt || !url) {
                      if (api?.handleJsonGeneration) {
                        try {
                          const generated = await api.handleJsonGeneration();
                          if (generated) {
                            url = generated;
                            setLastJsonUrl(generated);
                            setJsonBuilt(true);
                          }
                        } catch (err) {
                          console.error("JSON generation failed:", err);
                        }
                      }
                    }

                    if (!url) {
                      alert(
                        "JSON 생성에 실패했습니다. 에디터에서 변환을 완료해주세요."
                      );
                      return;
                    }

                    try {
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `${(
                        editorState.projectName || "project"
                      ).replace(/[^\\w.-]+/g, "_")}.json`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                    } catch (_) {
                      window.open(url, "_blank", "noopener");
                    }
                  }}
                  className="w-11 h-11 flex items-center justify-center rounded text-[#111827] transition-all duration-200 hover:bg-gray-100 active:bg-gray-200"
                >
                  <FaFileExport size={22} />
                </button>
                <span className="absolute -left-12 top-full mt-2 px-2 py-0.5 text-xs bg-gray-800 text-white rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-[100] pointer-events-none">
                  JSON으로 내보내기
                </span>
            </div>

            <div className="relative group">
              <button
                  onClick={async () => {
                    // JSON 생성 및 Unity 시뮬레이터 실행
                    if (api?.handleJsonGeneration) {
                      const jsonUrl = await api.handleJsonGeneration();
                      if (jsonUrl) {
                        setLastJsonUrl(jsonUrl);
                        setJsonBuilt(true);
                        showUnity(); // JSON 생성 후 Unity 시뮬레이터 실행
                      }
                    } else {
                      alert("JSON 생성 기능을 사용할 수 없습니다.");
                    }
                  }}
                  className="w-11 h-11 flex items-center justify-center rounded text-[#111827] transition-all duration-200 hover:bg-gray-100 active:bg-gray-200"
                >
                  <FaRegCirclePlay size={22}/>
                </button>
                <span className="absolute -left-24 top-full mt-2 px-2 py-0.5 text-xs bg-gray-800 text-white rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-[100] pointer-events-none">
                  Unity 시뮬레이터 실행
                </span>
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
                  ? "px-5 py-2 text-xl font-extrabold rounded bg-white/80 text-transparent bg-clip-text transition duration-200 hover:bg-white hover:underline underline-offset-4 decoration-2 decoration-white active:scale-95"
                  : "px-4.5 py-2 text-lg rounded bg-gray-900 text-white transition duration-200 hover:bg-black active:scale-95"
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
