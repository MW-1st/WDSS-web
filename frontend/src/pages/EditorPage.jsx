import React, { useEffect, useMemo, useRef, useState } from "react";
import EditorToolbar from "../components/EditorToolbar.jsx";
import MainCanvasSection from "../components/MainCanvasSection.jsx";
import SceneCarousel from "../components/SceneCarousel.jsx";
import client from "../api/client";
import { useUnity } from "../contexts/UnityContext.jsx";

const DUMMY = "11111111-1111-1111-1111-111111111111";

function useDebounced(fn, delay = 400) {
  const t = useRef(null);
  return (...args) => {
    if (t.current) clearTimeout(t.current);
    t.current = setTimeout(() => fn(...args), delay);
  };
}

export default function EditorPage({ projectId = DUMMY }) {
  // 프로젝트 및 씬 관리
  const [pid, setPid] = useState(projectId && projectId !== DUMMY ? projectId : null);
  const [scenes, setScenes] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [start, setStart] = useState(0);

  // 이미지 변환 관련 상태 (기존 기능)
  const [imageUrl, setImageUrl] = useState("");
  const [processing, setProcessing] = useState(false);
  const [targetDots, setTargetDots] = useState(2000);
  const stageRef = useRef(null);

  // Unity 관련 상태
  const { isUnityVisible, showUnity, hideUnity } = useUnity();

  // 선택된 씬 계산
  const selectedScene = useMemo(
    () => scenes.find((s) => s.id === selectedId) || null,
    [scenes, selectedId]
  );

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
      } catch (e) {
        console.error(e);
      }
    })();
  }, [selectedId, pid]);

  // 저장(디바운스)
  const saveDebounced = useDebounced(async (scene_id, drones, preview) => {
    if (!pid) return;
    try {
      const saved = await client.put(`/projects/${pid}/scenes/${scene_id}`, {
        project_id: pid,
        scene_id,
        drones,
        preview,
      });
      setScenes((prev) => prev.map((s) => (s.id === scene_id ? { ...s, ...saved } : s)));
    } catch (e) {
      console.error(e);
    }
  }, 500);

  // Canvas → 변경 반영
  const handleSceneChange = (id, patch) => {
    setScenes((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    saveDebounced(id, patch.data, patch.preview);
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
      if (nextTotal > 4) setStart(nextTotal - 4); // VISIBLE = 4
    } catch (e) {
      console.error(e);
      alert("씬 생성 실패");
    }
  };

  // 씬 선택
  const handleSelectScene = (id) => {
    setSelectedId(id);
  };

  // 업로드 완료 핸들러 (기존 기능)
  const handleUploaded = (webUrl) => {
    setImageUrl(webUrl || "");
  };

  // 이미지 변환 핸들러 (기존 기능)
  const handleTransform = async () => {
    if (!stageRef.current || !selectedId) return;

    try {
      setProcessing(true);
      const resp = await client.post(
        `/image/process?target_dots=${encodeURIComponent(
          targetDots
        )}&scene_id=${encodeURIComponent(selectedId)}`
      );

      let outputUrl = resp.data?.output_url || "";
      if (outputUrl.startsWith("http")) {
        setImageUrl(outputUrl);
      } else {
        const base = client.defaults.baseURL?.replace(/\/$/, "") || "";
        const path = String(outputUrl).replace(/\\/g, "/");
        setImageUrl(`${base}/${path.replace(/^\//, "")}`);
      }
    } catch (e) {
      console.error("Transform error", e);
      alert("이미지 변환 중 오류가 발생했습니다.");
    } finally {
      setProcessing(false);
    }
  };

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
        onSelectScene={handleSelectScene}
      />
    </div>
  );
}