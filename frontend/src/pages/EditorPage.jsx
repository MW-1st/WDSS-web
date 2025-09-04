import React, { useEffect, useMemo, useRef, useState } from "react";
import Canvas from "../components/Canvas.jsx";
import EditorToolbar from "../components/EditorToolbar.jsx";
import MainCanvasSection from "../components/MainCanvasSection.jsx";
import SceneCarousel from "../components/SceneCarousel.jsx";
import ImageGallery from "../components/ImageGallery.jsx";
import client from "../api/client";
import { useUnity } from "../contexts/UnityContext.jsx";
import {useParams} from "react-router-dom";

const VISIBLE = 4;
const THUMB_W = 200;
const THUMB_H = 120;
const GAP = 48;
const BTN_SIZE = 48;
const DUMMY = "11111111-1111-1111-1111-111111111111";

function useDebounced(fn, delay = 400) {
  const t = useRef(null);
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);
  const debounced = React.useCallback((...args) => {
    if (t.current) clearTimeout(t.current);
    t.current = setTimeout(() => fnRef.current(...args), delay);
  }, [delay]);
  return debounced;
}

export default function EditorPage({ projectId = DUMMY }) {
  // 프로젝트 및 씬 관리 상태
  const {project_id} = useParams();
  const [pid, setPid] = useState(project_id);
  const [scenes, setScenes] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [start, setStart] = useState(0);

  // 이미지 변환 관련 상태
  const [imageUrl, setImageUrl] = useState("");
  const [processing, setProcessing] = useState(false);
  const [targetDots, setTargetDots] = useState(2000);
  const stageRef = useRef(null);

  // 캔버스 관련 상태
  const [drawingMode, setDrawingMode] = useState('draw');
  const [eraserSize, setEraserSize] = useState(20);
  // const sceneId = 1; // 현재 에디터의 씬 ID (임시 하드코딩)

  // unity 관련 상태
  const { isUnityVisible, showUnity, hideUnity, sendTestData } = useUnity();

  // 프로젝트가 없으면 생성하는 헬퍼
  const ensureProjectId = async () => {
    if (pid) return pid;
    const newId =
      (crypto && crypto.randomUUID)
        ? crypto.randomUUID()
        : ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g,c=>(c^crypto.getRandomValues(new Uint8Array(1))[0]&15>>c/4).toString(16));

    const { data } = await client.post("/projects", {
      id: newId,
      project_name: "Untitled Project",
      user_id: null,
    });
    setPid(data.id);
    return data.id;
  };

  // 초기: 프로젝트가 있으면 목록 로드
  useEffect(() => {
    if (!pid) return;
    (async () => {
      try {
        const { data: list } = await client.get(`/projects/${pid}/scenes/`);
        setScenes(list.map((s, i) => ({ ...s, name: s.name || `Scene ${s.scene_num ?? i + 1}` })));
        if (list[0]) setSelectedId(list[0].id);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [pid]);

  // 씬 선택 → 상세 로드
  useEffect(() => {
    if (!pid) return;
    (async () => {
      if (!selectedId) return;
      const current = scenes.find((s) => s.id === selectedId);
      if (!current || "drones" in current) return;
      try {
        const { data: detail } = await client.get(`/projects/${pid}/scenes/${selectedId}`);
        setScenes((prev) => prev.map((s) => (s.id === selectedId ? { ...s, ...detail } : s)));

        // 씬이 변경될 때 해당 씬의 이미지 URL도 업데이트
        if (detail.imageUrl) {
          setImageUrl(detail.imageUrl);
        } else {
          setImageUrl("");
        }
      } catch (e) {
        console.error(e);
      }
    })();
  }, [selectedId, pid, scenes]);

  // 저장(디바운스)
  const saveDebounced = useDebounced(async (scene_id, drones, preview, imageUrl) => {
    if (!pid) return;
    try {
      const { data: saved } = await client.put(`/projects/${pid}/scenes/${scene_id}`, {
        project_id: pid,
        scene_id,
        drones,
        preview,
        imageUrl, // 이미지 URL도 저장
      });
      setScenes((prev) => prev.map((s) => (s.id === scene_id ? { ...s, ...saved } : s)));
    } catch (e) {
      console.error(e);
    }
  }, 500);

  // Canvas → 변경 반영
  const handleSceneChange = React.useCallback((id, patch) => {
    setScenes((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    saveDebounced(id, patch.data, patch.preview, imageUrl);
  }, [saveDebounced, imageUrl, setScenes]);

  // + 생성
  const handleAddScene = async () => {
    try {
      const projectIdReady = await ensureProjectId();
      console.log("확인된 Project ID:", projectIdReady);
      const scene_num = scenes.length + 1;
      console.log("확인된 scene_num:", scene_num);
      const { data: created } = await client.post(`/projects/${projectIdReady}/scenes/`, {
        project_id: projectIdReady,
        scene_num,
      });

      const nextScenes = [...scenes, created];
      setScenes(nextScenes);
      setSelectedId(created.id);

      // console.log(`created ${created}`)
      // console.log(`setSelectedId ${created.id}`)
      const nextTotal = nextScenes.length + 1;
      if (nextTotal > VISIBLE) setStart(nextTotal - VISIBLE);

      // 새 씬으로 전환하면서 이미지 URL 초기화
      setImageUrl("");
    } catch (e) {
      console.error(e);
      alert("씬 생성 실패");
    }
  };

  // 선택
  const handleSelect = (id) => {
    if (id === "__ADD__") return;
    setSelectedId(id);
    const idx = items.findIndex((it) => it.id === id);
    if (idx < start) setStart(idx);
    if (idx >= start + VISIBLE) setStart(idx - VISIBLE + 1);
  };

   // + 카드까지 포함
  const items = useMemo(() => [...scenes, { id: "__ADD__", isAdd: true }], [scenes]);
  const total = items.length;
  const canSlide = total > VISIBLE;
  const end = Math.min(start + VISIBLE, total);
  const visibleItems = items.slice(start, end);

  const selectedScene = useMemo(
    () => scenes.find((s) => s.id === selectedId) || null,
    [scenes, selectedId]
  );



  // 이미지 변환 핸들러
  const handleTransform = async () => {
    // 사전 조건 확인: 씬 선택 및 캔버스 준비 여부
    if (!selectedId) {
      alert("먼저 씬을 추가하거나 선택해 주세요.");
      return;
    }
    if (!pid) {
      alert("프로젝트 ID가 없습니다. 페이지를 새로고침해 주세요.");
      return;
    }
    if (!stageRef.current) {
      alert("캔버스가 아직 준비되지 않았습니다. 잠시 후 다시 시도해 주세요.");
      return;
    }
    
    console.log("Transform 시작 - pid:", pid, "selectedId:", selectedId);
    console.log("selectedScene:", selectedScene);
    console.log("selectedScene.scene_num:", selectedScene?.scene_num);

    try {
      setProcessing(true);
      
      // 캔버스에 펜으로 그린 내용이 있는지 확인
      const hasContent = stageRef.current.hasDrawnContent && stageRef.current.hasDrawnContent();
      
      if (hasContent) {
        console.log("캔버스에 그려진 내용이 있어서 캔버스를 변환합니다");
        // 현재 캔버스 내용을 이미지로 변환
        const canvasImage = stageRef.current.exportCanvasAsImage();
        
        if (!canvasImage) {
          alert("캔버스 이미지를 생성할 수 없습니다.");
          setProcessing(false);
          return;
        }
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        img.onload = async () => {
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
          
          // 캔버스를 blob으로 변환
          canvas.toBlob(async (blob) => {
            console.log("Generated blob:", blob);
            console.log("Blob size:", blob.size);
            console.log("Blob type:", blob.type);
            
            // File 객체로 변환 (ImageUpload와 동일한 방식)
            const file = new File([blob], 'canvas_drawing.png', { type: 'image/png' });
            console.log("Created file:", file);
            
            const fd = new FormData();
            fd.append('image', file);
            
            try {
              // 먼저 캔버스 이미지를 업로드
              console.log("캔버스 이미지를 업로드합니다");
              console.log("pid:", pid, "selectedId:", selectedId);
              console.log("pid type:", typeof pid, "selectedId type:", typeof selectedId);
              console.log("업로드 URL:", `/projects/${pid}/scenes/${selectedId}/upload-image`);
              
              // project_id와 scene_id 모두 UUID로 유지
              const projectId = pid; // UUID 형식 그대로 사용
              const sceneId = selectedId; // UUID 형식 그대로 사용
              console.log("Using - projectId (UUID):", projectId, "sceneId (UUID):", sceneId);
              const uploadResp = await client.post(`/projects/${projectId}/scenes/${sceneId}/upload-image`, fd);
              const uploadedImagePath = uploadResp.data?.image_url;
              
              if (!uploadedImagePath) {
                alert("캔버스 이미지 업로드에 실패했습니다.");
                setProcessing(false);
                return;
              }
              
              console.log("업로드된 이미지:", uploadedImagePath);
              
              // 캔버스 이미지를 직접 변환 API로 전달
              console.log("캔버스 이미지를 직접 변환 API로 전달");
              const transformFd = new FormData();
              transformFd.append('file', file);
              
              const resp = await client.post(
                `/image/process?target_dots=${encodeURIComponent(targetDots)}`,
                transformFd,
                {
                  headers: {
                    'Content-Type': 'multipart/form-data'
                  }
                }
              );
              let outputUrl = resp.data?.output_url || "";
              console.log("변환 완료, 서버 응답:", resp.data);
              console.log("새로운 SVG URL:", outputUrl);
              
              if (!outputUrl) {
                alert("서버에서 변환된 이미지 URL을 받지 못했습니다.");
                setProcessing(false);
                return;
              }
              
              // 먼저 캔버스 초기화 (기존 내용 제거)
              if (stageRef.current && stageRef.current.clear) {
                stageRef.current.clear();
              }
              
              let finalUrl;
              if (outputUrl.startsWith("http")) {
                finalUrl = outputUrl;
              } else {
                const base = client.defaults.baseURL?.replace(/\/$/, "") || "";
                const path = String(outputUrl).replace(/\\/g, "/");
                finalUrl = `${base}/${path.replace(/^\//, "")}`;
              }
              
              console.log("최종 이미지 URL:", finalUrl);
              setImageUrl(finalUrl);
              
              // 변환된 이미지 URL을 현재 씬에 저장
              if (selectedId && pid) {
                saveDebounced(selectedId, selectedScene?.drones, selectedScene?.preview, finalUrl);
              }
            } catch (e) {
              console.error("Canvas transform error", e);
              console.error("Full error object:", e);
              console.error("Error response:", e.response);
              console.error("Error status:", e.response?.status);
              console.error("Error data:", e.response?.data);
              console.error("Error headers:", e.response?.headers);
              console.error("Request URL:", e.config?.url);
              console.error("Request method:", e.config?.method);
              console.error("Request data:", e.config?.data);
              
              let errorMsg = e.response?.data?.detail || e.response?.data?.message || e.message;
              if (typeof errorMsg === 'object') {
                errorMsg = JSON.stringify(errorMsg);
              }
              alert(`캔버스 변환 중 오류가 발생했습니다: ${errorMsg}`);
            } finally {
              setProcessing(false);
            }
          }, 'image/png');
        };
        
        img.src = canvasImage;
      } else {
        console.log("캔버스에 그려진 내용이 없습니다. 먼저 캔버스에 그림을 그리거나 이미지를 추가해주세요.");
        alert("캔버스에 그려진 내용이 없습니다. 먼저 펜으로 그림을 그리거나 이미지를 드래그&드롭으로 추가해주세요.");
        setProcessing(false);
        return;
      }

      // 변환된 이미지 URL을 현재 씬에 저장은 각 분기에서 처리
    } catch (e) {
      console.error("Transform error", e);
      console.error("Error details:", e.response?.data || e.message);
      alert(`이미지 변환 중 오류가 발생했습니다: ${e.response?.data?.message || e.message}`);
      setProcessing(false);
    }
  };

  // 버튼 스타일
  const buttonStyle = {
    padding: "10px 20px",
    backgroundColor: "#007bff",
    color: "white",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    marginRight: "10px",
  };
  const sendButtonStyle = { ...buttonStyle, backgroundColor: "#28a745" };
  const closeButtonStyle = { ...buttonStyle, backgroundColor: "#dc3545" };

  // 캔버스 핸들러 함수들
  const handleModeChange = (mode) => {
    setDrawingMode(mode);
    if (stageRef.current && stageRef.current.setDrawingMode) {
      stageRef.current.setDrawingMode(mode);
    }
  };

  const handleClearAll = () => {
    if (stageRef.current && stageRef.current.clear) {
      if (confirm('캔버스의 모든 내용을 지우시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
        stageRef.current.clear();
        console.log('캔버스 전체가 초기화되었습니다');
      }
    }
  };

  return (
    <div style={{ width: "100%", background: "#fff", display: 'flex', minHeight: '100vh' }}>
      <aside
        style={{
          width: 280,
          borderRight: '1px solid #eee',
          padding: 16,
          position: 'sticky',
          top: 0,
          alignSelf: 'flex-start',
          height: '100vh',
          overflowY: 'auto',
          background: '#fff',
        }}
      >
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
          onImageDragStart={(imageUrl) => console.log('Image drag started:', imageUrl)}
          drawingMode={drawingMode}
          eraserSize={eraserSize}
          onModeChange={handleModeChange}
          onClearAll={handleClearAll}
          stageRef={stageRef} // stageRef prop 전달
          layout="sidebar"
        />
      </aside>
      <div style={{ flex: 1 }}>
      {/* 업로드 및 도구 바 */}
      

        {/* 메인 캔버스 */}
        <MainCanvasSection
          selectedScene={selectedScene}
          imageUrl={imageUrl}
          stageRef={stageRef}
          onChange={handleSceneChange}
          drawingMode={drawingMode}
          eraserSize={eraserSize}
          onModeChange={handleModeChange}
        />

      {/* 씬 캐러셀 */}
      <SceneCarousel
        scenes={scenes}
        selectedId={selectedId}
        start={start}
        setStart={setStart}
        onAddScene={handleAddScene}
        onSelectScene={handleSelect}
      />
      </div>
    </div>
  );
}
