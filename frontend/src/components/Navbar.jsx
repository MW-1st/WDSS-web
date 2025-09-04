import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import client from "../api/client";
import { useUnity } from "../contexts/UnityContext.jsx";

export default function Navbar() {
  const location = useLocation();
  const { isAuthenticated, logout } = useAuth();
  const { isUnityVisible, showUnity, hideUnity } = useUnity();

  // Local mirror of editor state for navbar controls
  const [editorState, setEditorState] = React.useState(() => {
    const api = typeof window !== "undefined" ? window.editorAPI : undefined;
    return api
      ? {
          targetDots: api.targetDots,
          processing: api.processing,
          imageUrl: api.imageUrl,
          selectedId: api.selectedId,
          projectName: api.projectName,
        }
      : {
          targetDots: 2000,
          processing: false,
          imageUrl: "",
          selectedId: null,
          projectName: "",
        };
  });

  React.useEffect(() => {
    const handler = (e) => {
      const detail = e.detail || {};
      setEditorState((prev) => ({ ...prev, ...detail }));
    };
    window.addEventListener("editor:updated", handler);
    return () => window.removeEventListener("editor:updated", handler);
  }, []);

  // Editor-specific navbar (project routes)
  if (location.pathname.startsWith("/projects")) {
    const api = typeof window !== "undefined" ? window.editorAPI : undefined;
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
          alert(
            "그릴 도트가 없습니다. 먼저 이미지 변환하거나 그림을 그려주세요."
          );
          return;
        }
        const svgBlob = new Blob([canvasSvgData.svgString], {
          type: "image/svg+xml",
        });
        const fd = new FormData();
        fd.append(
          "file",
          new File([svgBlob], "modified_canvas.svg", { type: "image/svg+xml" })
        );
        const jsonResp = await client.post("/image/svg-to-json", fd);
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
            {/* Slider */}
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

              {/* Transform */}
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

            <div className="flex items-center gap-2">
              {/* JSON make */}
              <button
                onClick={handleJsonGeneration}
                className="px-3 py-1.5 rounded !bg-blue-600 hover:!bg-blue-700 text-white"
              >
                JSON 파일로만들기
              </button>

              {/* Unity open/close */}
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

  return (
    <nav className="flex items-center justify-between px-4 py-2 mb-4">
      <div className="flex-1 flex justify-center gap-40 font-yuniverse">
        <Link to="/">Main</Link>
        <Link to="/dashboard">Dashboard</Link>
        {!isAuthenticated && <Link to="/login">Login</Link>}
        {isAuthenticated && <Link to="/projects">Projects</Link>}
      </div>

      {isAuthenticated && (
        <button onClick={logout} className="ml-4 font-yuniverse">
          Logout
        </button>
      )}
    </nav>
  );
}
