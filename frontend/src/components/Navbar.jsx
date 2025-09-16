import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useUnity } from "../contexts/UnityContext.jsx";
import client from "../api/client";
import { ImExit } from "react-icons/im";
import { FaFileExport } from "react-icons/fa6";
import { FaRegCirclePlay } from "react-icons/fa6";


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
          console.log('JSON URL received from editor:', jsonUrl);
          setLastJsonUrl(jsonUrl);
          setJsonBuilt(true);
        }
      };
      window.addEventListener("editor:json-ready", handler);
      return () => window.removeEventListener("editor:json-ready", handler);
    }, []);

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
      <nav className="px-4 py-2 flex justify-center font-nanumhuman border-b border-gray-200">
        <div className="w-full flex justify-between items-center gap-40">
          {/* Logo + Project name */}
          <div className="flex items-center gap-3">
            <Link to="/" title="메인 페이지" className="logo-press flex items-center">
              <img src="/img/Logo.png" alt="Logo" className="h-10 w-auto" />
            </Link>
            <div
              className="font-extrabold text-2xl max-w-[480px] truncate"
              title={editorState.projectName || "Untitled Project"}
            >
              {editorState.projectName || "Untitled Project"}
            </div>
          </div>
          {/* JSON + Unity Controls */}
          <div className="flex items-center gap-2">
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
                  className="px-3 rounded text-[#111827] font-extrabold text-2xl transition-all duration-200 hover:translate-y-[1px] active:translate-y-[2px]"
                >
                  <FaFileExport size={26} />
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
                  className="rounded text-[#111827] font-bold text-2xl transition-all duration-200 hover:translate-y-[1px] active:translate-y-[2px]"
                >
                  <FaRegCirclePlay size={26}/>
                </button>
                <span className="absolute -left-24 top-full mt-2 px-2 py-0.5 text-xs bg-gray-800 text-white rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-[100] pointer-events-none">
                  Unity 시뮬레이터 실행
                </span>
            </div>

              {isUnityVisible && (
                <button
                  className="px-3 py-1.5 rounded !bg-red-600 hover:!bg-red-700 text-white flex items-center gap-2"
                  onClick={hideUnity}
                >
                  Unity 시뮬레이터 닫기
                </button>
              )}

              
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
