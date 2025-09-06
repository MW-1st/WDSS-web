import React, { useEffect, useMemo, useRef, useState } from "react";
import EditorToolbar from "../components/EditorToolbar.jsx";
import MainCanvasSection from "../components/MainCanvasSection.jsx";
import SceneCarousel from "../components/SceneCarousel.jsx";
import ImageGallery from "../components/ImageGallery.jsx";
import ObjectPropertiesPanel from "../components/ObjectPropertiesPanel.jsx";
import client from "../api/client";
import { useUnity } from "../contexts/UnityContext.jsx";
import { useParams } from "react-router-dom";

const VISIBLE = 4;
const DUMMY = "11111111-1111-1111-1111-111111111111";

const LEFT_TOOL_WIDTH = 100;
const RIGHT_PANEL_WIDTH = 260;

function useDebounced(fn, delay = 400) {
  const t = useRef(null);
  const fnRef = useRef(fn);
  useEffect(() => { fnRef.current = fn; }, [fn]);
  return React.useCallback((...args) => {
    if (t.current) clearTimeout(t.current);
    t.current = setTimeout(() => fnRef.current(...args), delay);
  }, [delay]);
}

// 실제 스크롤바 폭 측정 (Windows 레이아웃형 스크롤 대응)

export default function EditorPage({ projectId = DUMMY }) {
  const { project_id } = useParams();
  const [pid, setPid] = useState(project_id);

  const [scenes, setScenes] = useState([]);
  const [projectName, setProjectName] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [start, setStart] = useState(0);

  const [galleryOpen, setGalleryOpen] = useState(true);

  const [imageUrl, setImageUrl] = useState("");
  const [processing, setProcessing] = useState(false);
  const [targetDots, setTargetDots] = useState(2000);
  const [originalCanvasState, setOriginalCanvasState] = useState(null);
  const stageRef = useRef(null);
  const galleryRef = useRef(null);

  const [drawingMode, setDrawingMode] = useState("draw");
  const [eraserSize, setEraserSize] = useState(20);
  const [drawingColor, setDrawingColor] = useState("#222222");
  const [selectedObject, setSelectedObject] = useState(null);

  const { isUnityVisible, showUnity, hideUnity } = useUnity();


  useEffect(() => {
    stageRef.current?.setDrawingColor?.(drawingColor);
  }, [drawingColor]);

  const ensureProjectId = async () => {
    if (pid) return pid;
    const newId =
      crypto?.randomUUID?.() ??
      ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) =>
        (c ^
          (crypto.getRandomValues(new Uint8Array(1))[0] &
            (15 >> (c / 4)))).toString(16)
      );
    const { data } = await client.post("/projects", {
      id: newId, project_name: "Untitled Project", user_id: null,
    });
    setPid(data.id);
    setProjectName("Untitled Project");
    return data.id;
  };

  useEffect(() => {
    if (!pid) return;
    (async () => {
      try {
        const { data: proj } = await client.get(`/projects/${pid}`);
        if (proj?.project_name) setProjectName(proj.project_name);
      } catch {}
    })();
  }, [pid]);

  useEffect(() => {
    if (!pid) return;
    (async () => {
      try {
        const { data: list } = await client.get(`/projects/${pid}/scenes/`);
        setScenes(list.map((s, i) => ({ ...s, name: s.name || `Scene ${s.scene_num ?? i + 1}` })));
        if (list[0]) setSelectedId(list[0].id);
      } catch (e) { console.error(e); }
    })();
  }, [pid]);

  useEffect(() => {
    if (!pid || !selectedId) return;
    (async () => {
      const current = scenes.find(s => s.id === selectedId);
      if (!current || "drones" in current) return;
      try {
        const { data: detail } = await client.get(`/projects/${pid}/scenes/${selectedId}`);
        setScenes(prev => prev.map(s => (s.id === selectedId ? { ...s, ...detail } : s)));
        setImageUrl(detail.imageUrl || "");
        setOriginalCanvasState(detail.originalCanvasState || null);
      } catch (e) { console.error(e); }
    })();
  }, [selectedId, pid, scenes]);

  const saveDebounced = useDebounced(async (scene_id, drones, preview, imageUrl, originalCanvasState) => {
    if (!pid) return;
    try {
      const { data: saved } = await client.put(`/projects/${pid}/scenes/${scene_id}`, {
        project_id: pid, scene_id, drones, preview, imageUrl, originalCanvasState
      });
      setScenes(prev => prev.map(s => (s.id === scene_id ? { ...s, ...saved } : s)));
    } catch (e) { console.error(e); }
  }, 500);

  const handleSceneChange = React.useCallback((id, patch) => {
    setScenes(prev => prev.map(s => (s.id === id ? { ...s, ...patch } : s)));
    saveDebounced(id, patch.data, patch.preview, imageUrl, originalCanvasState);
  }, [saveDebounced, imageUrl, originalCanvasState]);

  const handleAddScene = async () => {
    try {
      const projectIdReady = await ensureProjectId();
      const scene_num = scenes.length + 1;
      const { data: created } = await client.post(
        `/projects/${projectIdReady}/scenes/`,
        { project_id: projectIdReady, scene_num }
      );
      const next = [...scenes, created];
      setScenes(next);
      setSelectedId(created.id);
      if (next.length + 1 > VISIBLE) setStart(next.length + 1 - VISIBLE);
      setImageUrl("");
      setOriginalCanvasState(null);
    } catch (e) { console.error(e); alert("씬 생성 실패"); }
  };

  const handleSelect = (id) => {
    if (id === "__ADD__") return;
    setSelectedId(id);
    const items = [...scenes, { id: "__ADD__", isAdd: true }];
    const idx = items.findIndex(it => it.id === id);
    if (idx < start) setStart(idx);
    if (idx >= start + VISIBLE) setStart(idx - VISIBLE + 1);
  };

  const selectedScene = useMemo(
    () => scenes.find(s => s.id === selectedId) || null,
    [scenes, selectedId]
  );

  const handleTransform = async () => {
    if (!selectedId) return alert("먼저 씬을 추가하거나 선택해 주세요.");
    if (!pid) return alert("프로젝트 ID가 없습니다. 페이지를 새로고침해 주세요.");
    if (!stageRef.current) return alert("캔버스가 아직 준비되지 않았습니다.");
    try {
      setProcessing(true);
      const hasContent = stageRef.current.hasDrawnContent?.();
      if (!hasContent) { alert("변환할 내용이 없습니다."); setProcessing(false); return; }

      if (!originalCanvasState) {
        const s = stageRef.current.saveOriginalCanvasState?.();
        if (s) setOriginalCanvasState(s);
      } else {
        stageRef.current.restoreOriginalCanvasState?.(originalCanvasState);
        await new Promise(r => setTimeout(r, 100));
      }

      const canvasImage = stageRef.current.exportCanvasAsImage?.();
      if (!canvasImage) { alert("캔버스 이미지를 생성할 수 없습니다."); setProcessing(false); return; }

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const img = new Image();
      img.onload = async () => {
        canvas.width = img.width; canvas.height = img.height; ctx.drawImage(img, 0, 0);
        canvas.toBlob(async (blob) => {
          const file = new File([blob], "canvas_drawing.png", { type: "image/png" });
          const fd = new FormData(); fd.append("image", file);
          try {
            await client.post(`/projects/${pid}/scenes/${selectedId}/upload-image`, fd);

            const transformFd = new FormData(); transformFd.append("file", file);

            const hexToRgb = (hex) => {
              const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
              return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : { r:0,g:0,b:0 };
            };
            const rgb = hexToRgb(drawingColor);

            const resp = await client.post(
              `/image/process?target_dots=${encodeURIComponent(targetDots)}&color_r=${rgb.r}&color_g=${rgb.g}&color_b=${rgb.b}`,
              transformFd,
              { headers: { "Content-Type": "multipart/form-data" } }
            );

            let outputUrl = resp.data?.output_url || "";
            if (!outputUrl) { alert("서버에서 변환된 이미지 URL을 받지 못했습니다."); setProcessing(false); return; }

            stageRef.current?.clear?.();

            const base = client.defaults.baseURL?.replace(/\/$/, "") || "";
            const path = String(outputUrl).replace(/\\\\/g, "/");
            const finalUrl = outputUrl.startsWith("http") ? outputUrl : `${base}/${path.replace(/^\//,"")}`;
            setImageUrl(finalUrl);

            saveDebounced(selectedId, selectedScene?.drones, selectedScene?.preview, finalUrl, originalCanvasState);
          } catch (e) {
            console.error(e);
            alert(`캔버스 변환 중 오류: ${e.response?.data?.detail || e.response?.data?.message || e.message}`);
          } finally { setProcessing(false); }
        }, "image/png");
      };
      img.src = canvasImage;
    } catch (e) {
      console.error(e);
      alert(`이미지 변환 중 오류: ${e.response?.data?.message || e.message}`);
      setProcessing(false);
    }
  };

  const handleModeChange = React.useCallback((mode) => {
    setDrawingMode(mode);
    stageRef.current?.setDrawingMode?.(mode);
    setTimeout(() => stageRef.current?.setDrawingColor?.(drawingColor), 20);
  }, [drawingColor]);

  const handleClearAll = React.useCallback(() => {
    if (!stageRef.current?.clear) return;
    if (confirm("캔버스의 모든 내용을 지우시겠습니까?")) stageRef.current.clear();
  }, []);

  const handleColorChange = React.useCallback((color) => {
    setDrawingColor(color);
    stageRef.current?.setDrawingColor?.(color);
  }, []);

  const handleColorPreview = React.useCallback((color) => {
    setDrawingColor(color);
    stageRef.current?.setDrawingColor?.(color);
  }, []);

  const handleSelectedFillChange = React.useCallback((hex) => {
    const canvas = stageRef.current;
    const active = canvas?.getActiveObject?.();
    if (!active) return;
    if (active.customType === "svgDot" || active.customType === "drawnDot" || active.type === "circle") {
      active.set({ fill: hex, originalFill: hex });
      canvas.renderAll?.();
      setSelectedObject(prev => (prev ? { ...prev, fill: hex } : prev));
    }
  }, []);

  return (
    <div
      className="editor-shell"
      style={{
        width: "100%",
        minHeight: "100vh",
        background: "#fff",
        display: "flex",
        alignItems: "flex-start",
        gap: 16,                 // 부모가 간격 관리
        boxSizing: "border-box",
        overflowX: "hidden",     // 가로 스크롤 가드
      }}
    >
      {/* 왼쪽 툴바 */}
      <aside
        id="left-rail"
        style={{
          width: LEFT_TOOL_WIDTH,
          borderRight: "1px solid #eee",
          position: "sticky",
          top: 0,
          height: "100vh",
          background: "#fff",
          flex: "0 0 auto",
          boxSizing: "border-box",
          overflow: "visible",   // 팝오버가 밖으로 나올 수 있도록
          zIndex: 50,
        }}
      >
        {/* 내부에서만 스크롤 */}
        <div style={{ height: "100%", overflowY: "auto", padding: 16 }}>
          <EditorToolbar
            pid={pid}
            selectedId={selectedId}
            imageUrl={imageUrl}
            targetDots={targetDots}
            setTargetDots={setTargetDots}
            processing={processing}
            onTransform={handleTransform}
            isUnityVisible={isUnityVisible}
            showUnity={showUnity}
            hideUnity={hideUnity}
            onImageDragStart={(u) => console.log("Image drag:", u)}
            drawingMode={drawingMode}
            eraserSize={eraserSize}
            drawingColor={drawingColor}
            onModeChange={handleModeChange}
            onColorChange={handleColorChange}
            onColorPreview={handleColorPreview}
            onClearAll={handleClearAll}
            stageRef={stageRef}
            layout="sidebar"
            onGalleryStateChange={setGalleryOpen}
          />
        </div>
      </aside>

      {/* 갤러리 패널 */}
      {galleryOpen && (
        <div style={{ flex: "0 1 360px", minWidth: 0, boxSizing: "border-box" }}>
          <ImageGallery onImageDragStart={(u) => console.log("drag:", u)} />
        </div>
      )}

      {/* 메인 */}
      <div
        style={{
          flex: "1 1 0%",
          minWidth: 0,
        }}
      >
        <MainCanvasSection
          selectedScene={selectedScene}
          imageUrl={imageUrl}
          stageRef={stageRef}
          onChange={handleSceneChange}
          drawingMode={drawingMode}
          eraserSize={eraserSize}
          drawingColor={drawingColor}
          onModeChange={handleModeChange}
          onSelectionChange={setSelectedObject}
        />

        <SceneCarousel
          scenes={scenes}
          selectedId={selectedId}
          start={start}
          setStart={setStart}
          onAddScene={handleAddScene}
          onSelectScene={handleSelect}
          compact={galleryOpen}
        />
      </div>

      {/* 오른쪽 패널 */}
      <aside
        style={{
          width: RIGHT_PANEL_WIDTH,
          borderLeft: "1px solid #eee",
          position: "sticky",
          top: 0,
          height: "100vh",
          background: "#fff",
          flex: "0 0 auto",
          boxSizing: "border-box",
          overflow: "visible",   // 팝오버가 밖으로
          zIndex: 50,
        }}
      >
        <div style={{ height: "100%", overflowY: "auto", padding: 16 }}>
          <ObjectPropertiesPanel
            selection={selectedObject}
            onChangeFill={handleSelectedFillChange}
          />
        </div>
      </aside>
    </div>
  );
}
