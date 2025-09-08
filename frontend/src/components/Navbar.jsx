import React from "react";
import {Link, useLocation, useParams} from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useUnity } from "../contexts/UnityContext.jsx";
import client from "../api/client";

export default function Navbar({ transparent: propTransparent = false }) {
  const location = useLocation();
  const { isAuthenticated, logout } = useAuth();
  const { isUnityVisible, showUnity, hideUnity } = useUnity();

  // ===== ① 에디터(프로젝트) 전용 Navbar =====
  if (location.pathname.startsWith("/projects")) {
    const projectId = location.pathname.split('/')[2];

    const api = typeof window !== "undefined" ? window.editorAPI : undefined;

    const [editorState, setEditorState] = React.useState(() => ({
      targetDots: api?.targetDots || 2000,
      processing: api?.processing || false,
      imageUrl: api?.imageUrl || "",
      selectedId: api?.selectedId || null,
      projectName: api?.projectName || "",
    }));

    const sceneId = editorState.selectedId;

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
        if (
          !api?.stageRef?.current ||
          !api.stageRef.current.getCurrentCanvasAsSvg
        ) {
          alert("캔버스가 준비되지 않았습니다.");
          return;
        }
        const canvasSvgData = api.stageRef.current.getCurrentCanvasAsSvg();
        if (!canvasSvgData || canvasSvgData.totalDots === 0) {
          alert("그릴 도트가 없습니다. 먼저 이미지 변환하거나 그림을 그려주세요.");
          return;
        }
        const svgBlob = new Blob([canvasSvgData.svgString], {
          type: "image/svg+xml",
        });
        // 1. processed 저장용 FormData
        const saveFormData = new FormData();
        saveFormData.append(
          "svg_file", // 백엔드 파라미터명과 일치시켜야 함
          new File([svgBlob], `${sceneId}.svg`, { type: "image/svg+xml" })
        );

        // 2. JSON 생성용 FormData (별도 생성)
        const jsonFormData = new FormData();
        jsonFormData.append(
          "file",
          new File([svgBlob], `${sceneId}.svg`, { type: "image/svg+xml" })
        );

        // 3. processed 저장
        try {
          await client.put(
            `/projects/${projectId}/scenes/${sceneId}/processed`,
            saveFormData
          );
        } catch (saveError) {
          console.error("Processed save error:", saveError);
          alert("캔버스 저장 중 오류가 발생했습니다.");
          return;
        }

        const jsonResp = await client.post("/image/svg-to-json", jsonFormData);
        const jsonUrl = jsonResp.data?.json_url;
        const unitySent = jsonResp.data?.unity_sent;
        if (jsonUrl) {
          const base = client.defaults.baseURL?.replace(/\/$/, "") || "";
          const full = jsonUrl.startsWith("http")
            ? jsonUrl
            : `${base}/${jsonUrl.replace(/^\//, "")}`;
          window.open(full, "_blank", "noopener");
          alert(
            unitySent
              ? `JSON 생성 및 Unity 전송 완료 (총 ${canvasSvgData.totalDots} 도트)`
              : `JSON 생성 완료 (총 ${canvasSvgData.totalDots} 도트)`
          );
        } else {
          alert("JSON 생성에 실패했습니다.");
        }
      } catch (e) {
        console.error("SVG to JSON error", e);
        alert("JSON 생성 중 오류가 발생했습니다.");
      }
    };

    return (
      <nav className="px-4 py-2 mb-4 flex justify-center">
        <div className="w-full flex justify-between items-center gap-40">
          {/* Project name */}
          <div
            className="font-semibold max-w-[280px] truncate"
            title={editorState.projectName || "Untitled Project"}
          >
            {editorState.projectName || "Untitled Project"}
          </div>

          <div className="flex flex-1 justify-between">
            {/* Slider + Transform */}
            <div className="flex items-center gap-10">
              <div>
                <input
                  type="range"
                  min={100}
                  max={10000}
                  step={10}
                  value={Number(localDots) || 0}
                  onChange={handleRangeChange}
                  onMouseUp={commitDots}
                  onTouchEnd={commitDots}
                  onPointerUp={commitDots}
                  onPointerDown={(e) => e.stopPropagation()}
                  onPointerMove={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  className="w-56 cursor-pointer"
                />
                <span className="text-sm text-gray-600 min-w-[42px] text-right">
                  {localDots}
                </span>
              </div>

              <button
                onClick={() => api?.handleTransform && api.handleTransform()}
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
            </div>

            {/* JSON + Unity */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleJsonGeneration}
                className="px-3 py-1.5 rounded !bg-blue-600 hover:!bg-blue-700 text-white"
              >
                JSON 파일로만들기
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
          <Link className="hover:underline underline-offset-4 decoration-2" to="/">
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
