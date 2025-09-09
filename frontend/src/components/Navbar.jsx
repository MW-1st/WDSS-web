import React from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useUnity } from "../contexts/UnityContext.jsx";
import client from "../api/client";

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
    const [transformClicked, setTransformClicked] = React.useState(false);
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

    const handleJsonGeneration = async () => {
      try {
        const pathSegments = location.pathname.split("/");
        const projectId = pathSegments[2];

        if (!projectId) {
          alert("프로젝트 ID를 찾을 수 없습니다.");
          return;
        }

        // 현재 씬이 있고 수정사항이 있으면 먼저 저장
        if (sceneId && api?.stageRef?.current?.getCurrentCanvasAsSvg) {
          const canvasSvgData = api.stageRef.current.getCurrentCanvasAsSvg();
          if (canvasSvgData && canvasSvgData.totalDots > 0) {
            const svgBlob = new Blob([canvasSvgData.svgString], {
              type: "image/svg+xml",
            });

            const saveFormData = new FormData();
            saveFormData.append(
              "svg_file",
              new File([svgBlob], `${sceneId}.svg`, { type: "image/svg+xml" })
            );

            await client.put(
              `/projects/${projectId}/scenes/${sceneId}/processed`,
              saveFormData
            );
          }
        }

        // 모든 씬을 JSON으로 변환
        const response = await client.post(`/projects/${projectId}/json`);
        const { json_url, unity_sent, scenes_processed, total_scenes } =
          response.data;

        if (json_url) {
          const base = client.defaults.baseURL?.replace(/\/$/, "") || "";
          const full = json_url.startsWith("http")
            ? json_url
            : `${base}/${json_url.replace(/^\//, "")}`;
          try {
            setJsonBuilt(true);
            setLastJsonUrl(full);
          } catch {}
          // window.open(full, "_blank", "noopener");

          alert(
            unity_sent
              ? `${scenes_processed}/${total_scenes}개 씬이 JSON으로 변환되고 Unity로 전송되었습니다!`
              : `${scenes_processed}/${total_scenes}개 씬이 JSON으로 변환되었습니다!`
          );
        } else {
          alert("JSON 생성에 실패했습니다.");
        }
      } catch (e) {
        console.error("Export all scenes error", e);
        alert("전체 프로젝트 내보내기 중 오류가 발생했습니다.");
      }
    };

    return (
      <nav className="px-4 py-2 mb-4 flex justify-center font-nanumhuman">
        <div className="w-full flex justify-between items-center gap-40">
          {/* Logo + Project name */}
          <div className="flex items-center gap-3">
            <Link to="/" title="메인 페이지" className="logo-press flex items-center">
              <img src="/img/Logo.png" alt="Logo" className="h-10 w-auto" />
            </Link>
            <div
              className="font-extrabold text-3xl max-w-[480px] truncate"
              title={editorState.projectName || "Untitled Project"}
            >
              {editorState.projectName || "Untitled Project"}
            </div>
          </div>

          <div className="flex flex-1 justify-between">
            <button
              onClick={() => {
                setTransformClicked(true);
                setJsonBuilt(false);
                setLastJsonUrl("");
                api?.handleTransform && api.handleTransform();
              }}
              disabled={editorState.processing || !editorState.selectedId}
              className={`px-3 py-1.5 rounded text-white ${
                editorState.processing
                  ? "!bg-blue-600"
                  : "!bg-blue-600 hover:!bg-blue-700"
              }`}
              title={
                editorState.processing
                  ? "변환 중"
                  : !editorState.selectedId
                  ? "먼저 씬을 선택하세요"
                  : undefined
              }
            >
              변환
            </button>

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
                onClick={handleJsonGeneration}
                className="px-3 py-1.5 rounded !bg-blue-600 hover:!bg-blue-700 text-white"
              >
                JSON 파일로만들기
              </button>

              <button
                onClick={() => {
                  if (!transformClicked || !jsonBuilt) {
                    alert(
                      "먼저 '변환' 버튼과 'JSON 파일로만들기' 버튼을 순서대로 실행해 주세요."
                    );
                    return;
                  }
                  if (!lastJsonUrl) {
                    alert(
                      "다운로드할 JSON URL이 없습니다. 'JSON 파일로만들기'를 먼저 실행해 주세요."
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
