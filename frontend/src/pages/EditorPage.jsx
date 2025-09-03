import React, { useEffect, useMemo, useRef, useState } from "react";
import Canvas from "../components/Canvas.jsx";
import EditorToolbar from "../components/EditorToolbar.jsx";
import MainCanvasSection from "../components/MainCanvasSection.jsx";
import SceneCarousel from "../components/SceneCarousel.jsx";
import ImageUpload from "../components/ImageUpload.jsx";
import client from "../api/client";
import { useUnity } from "../contexts/UnityContext.jsx";

const VISIBLE = 4;
const THUMB_W = 200;
const THUMB_H = 120;
const GAP = 48;
const BTN_SIZE = 48;
const DUMMY = "11111111-1111-1111-1111-111111111111";

function useDebounced(fn, delay = 400) {
  const t = useRef(null);
  return (...args) => {
    if (t.current) clearTimeout(t.current);
    t.current = setTimeout(() => fn(...args), delay);
  };
}

export default function EditorPage({ projectId = DUMMY }) {
  // 프로젝트 및 씬 관리 상태
  const [pid, setPid] = useState(projectId && projectId !== DUMMY ? projectId : null);
  const [scenes, setScenes] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [start, setStart] = useState(0);

  // 이미지 변환 관련 상태
  const [imageUrl, setImageUrl] = useState("");
  const [processing, setProcessing] = useState(false);
  const [targetDots, setTargetDots] = useState(2000);
  const stageRef = useRef(null);
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
        const list = await client.get(`/projects/${pid}/scenes`);
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
        const detail = await client.get(`/projects/${pid}/scenes/${selectedId}`);
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
      const saved = await client.put(`/projects/${pid}/scenes/${scene_id}`, {
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
  const handleSceneChange = (id, patch) => {
    setScenes((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    saveDebounced(id, patch.data, patch.preview, imageUrl);
  };

  // + 생성
  const handleAddScene = async () => {
    try {
      const projectIdReady = await ensureProjectId();
      const scene_num = scenes.length + 1;
      const created = await client.post(`/projects/${projectIdReady}/scenes`, {
        project_id: projectIdReady,
        scene_num,
      });

      const nextScenes = [...scenes, created];
      setScenes(nextScenes);
      setSelectedId(created.id);
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


  // 업로드 완료 핸들러
  const handleUploaded = (webUrl) => {
    setImageUrl(webUrl || "");
    // 현재 선택된 씬에 이미지 URL 저장
    if (selectedId && pid) {
      saveDebounced(selectedId, selectedScene?.drones, selectedScene?.preview, webUrl);
    }
  };

  // 이미지 변환 핸들러
  const handleTransform = async () => {
    if (!stageRef.current || !selectedId) return;

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
            const fd = new FormData();
            fd.append('image', blob, 'canvas_drawing.png');
            
            try {
              // 먼저 캔버스 이미지를 업로드
              console.log("캔버스 이미지를 업로드합니다");
              const uploadResp = await client.post(`/projects/1/scenes/${sceneId}/upload-image`, fd);
              const uploadedImagePath = uploadResp.data?.image_url;
              
              if (!uploadedImagePath) {
                alert("캔버스 이미지 업로드에 실패했습니다.");
                setProcessing(false);
                return;
              }
              
              console.log("업로드된 이미지:", uploadedImagePath);
              
              // 업로드된 이미지를 변환
              const resp = await client.post(
                `/image/process?target_dots=${encodeURIComponent(targetDots)}&scene_id=${encodeURIComponent(sceneId)}`
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
            } catch (e) {
              console.error("Canvas transform error", e);
              alert("캔버스 변환 중 오류가 발생했습니다.");
            } finally {
              setProcessing(false);
            }
          }, 'image/png');
        };
        
        img.src = canvasImage;
      } else {
        console.log("캔버스에 그려진 내용이 없어서 기존 이미지를 변환합니다");
        // 기존 로직: 업로드된 이미지가 있을 때
        const resp = await client.post(
          `/image/process?target_dots=${encodeURIComponent(targetDots)}&scene_id=${encodeURIComponent(selectedId)}`
        );
        let outputUrl = resp.data?.output_url || "";
        if (outputUrl.startsWith("http")) {
          setImageUrl(outputUrl);
        } else {
          const base = client.defaults.baseURL?.replace(/\/$/, "") || "";
          const path = String(outputUrl).replace(/\\/g, "/");
          setImageUrl(`${base}/${path.replace(/^\//, "")}`);
        }
        setProcessing(false);
      }

      // 변환된 이미지 URL을 현재 씬에 저장
      if (selectedId && pid) {
        saveDebounced(selectedId, selectedScene?.drones, selectedScene?.preview, outputUrl);
      }
    } catch (e) {
      console.error("Transform error", e);
      alert("이미지 변환 중 오류가 발생했습니다.");
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

  return (
    <div style={{ width: "100%", background: "#fff" }}>
      {/* 업로드 및 도구 바 */}
      <EditorToolbar
        pid={pid}
        selectedId={selectedId}
        imageUrl={imageUrl}
        targetDots={targetDots}
        setTargetDots={setTargetDots}
        processing={processing}
        onUploaded={handleUploaded}
        onTransform={handleTransform}
        isUnityVisible={isUnityVisible}
        showUnity={showUnity}
        hideUnity={hideUnity}
      />

      {/* 메인 캔버스 */}
      <MainCanvasSection
        selectedScene={selectedScene}
        imageUrl={imageUrl}
        stageRef={stageRef}
        onChange={handleSceneChange}
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
  );
}
