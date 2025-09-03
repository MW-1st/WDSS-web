import React, { useEffect, useMemo, useRef, useState } from "react";
import Canvas from "../components/Canvas.jsx";
import ImageUpload from "../components/ImageUpload.jsx";
import ImageTransformControls from "../components/ImageTransformControls.jsx";
import UnitySimulatorControls from "../components/UnitySimulatorControls.jsx";
import * as api from "../api/scenes";
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
  const { isUnityVisible, showUnity, hideUnity, sendTestData } = useUnity();

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

  // 프로젝트가 없으면 생성하는 헬퍼
  const ensureProjectId = async () => {
    if (pid) return pid;
    const newId =
      (crypto && crypto.randomUUID)
        ? crypto.randomUUID()
        : ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g,c=>(c^crypto.getRandomValues(new Uint8Array(1))[0]&15>>c/4).toString(16));

    const { data } = await client.post("/api/projects", {
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
        const list = await api.get(`/api/projects/${pid}/scenes`);
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
        const detail = await api.get(`/api/projects/${pid}/scenes/${selectedId}`);
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
      const saved = await api.put(`/api/projects/${pid}/scenes/${scene_id}`, {
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
      const created = await api.post(`/api/projects/${projectIdReady}/scenes`, {
        project_id: projectIdReady,
        scene_num,
      });

      const nextScenes = [...scenes, created];
      setScenes(nextScenes);
      setSelectedId(created.id);
      const nextTotal = nextScenes.length + 1;
      if (nextTotal > VISIBLE) setStart(nextTotal - VISIBLE);
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
      {/* 업로드 바 */}
      <section style={{ display: "flex", justifyContent: "center", padding: "24px 0", borderBottom: "1px solid #eee" }}>
        <div style={{ width: "70%", maxWidth: 980 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, marginBottom: 12 }}>이미지 업로드</h2>
          <ImageUpload
            projectId={pid ?? ""}
            sceneId={selectedId ?? ""}
            onUploaded={handleUploaded}
          />

          {/* 변환 기능 */}
          <div style={{ marginTop: 16 }}>
            <ImageTransformControls
              targetDots={targetDots}
              setTargetDots={setTargetDots}
              processing={processing}
              onTransform={handleTransform}
              imageUrl={imageUrl}
              sceneId={selectedId}
            />
          </div>

          {/* Unity 기능 */}
          <UnitySimulatorControls
            isUnityVisible={isUnityVisible}
            showUnity={showUnity}
            hideUnity={hideUnity}
          />
        </div>
      </section>

      {/* 메인 캔버스 */}
      <section style={{ display: "flex", justifyContent: "center", padding: "24px 0 32px" }}>
        <div style={{ width: "70%", maxWidth: 980 }}>
          <div
            style={{
              width: "100%",
              aspectRatio: "16 / 9",
              background: "#f7f7f7",
              borderRadius: 8,
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "inset 0 0 0 1px #eee",
            }}
          >
            {selectedScene ? (
              <Canvas
                key={selectedScene.id}
                scene={selectedScene}
                width={1200}
                height={675}
                onChange={(patch) => handleSceneChange(selectedScene.id, patch)}
                imageUrl={imageUrl}
                stageRef={stageRef}
              />
            ) : (
              <div style={{ color: "#666", fontSize: 14 }}>
                아래 + 카드로 새 씬을 추가하세요
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 하단 트랙: 중앙 정렬 + 버튼은 바깥쪽 */}
      <section style={{ position: "relative", marginTop: 8, marginBottom: 72 }}>
        {/* Prev */}
        {canSlide && (
          <button
            onClick={() => setStart((s) => Math.max(0, s - 1))}
            disabled={start === 0}
            style={{
              position: "absolute",
              left: "calc(50% - 560px)",
              top: "50%",
              transform: "translateY(-50%)",
              width: BTN_SIZE,
              height: BTN_SIZE,
              borderRadius: "50%",
              border: "1px solid #cfcfe6",
              background: "#fff",
              boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 26, lineHeight: "1",
              cursor: start === 0 ? "not-allowed" : "pointer",
            }}
            aria-label="이전"
            title="이전"
          >
            ‹
          </button>
        )}

        {/* 중앙 썸네일 묶음 */}
        <div style={{ display: "flex", justifyContent: "center", gap: GAP }}>
          {visibleItems.map((item) =>
            item.isAdd ? (
              <button
                key="__ADD__"
                onClick={handleAddScene}
                aria-label="씬 추가하기"
                title="씬 추가하기"
                style={{
                  width: THUMB_W, height: THUMB_H, borderRadius: 8,
                  border: "1px dashed #999", background: "#fff",
                  fontSize: 28, color: "#666", cursor: "pointer",
                }}
              >
                +
              </button>
            ) : (
              <button
                key={item.id}
                onClick={() => handleSelect(item.id)}
                title={item.name}
                style={{
                  width: THUMB_W,
                  height: THUMB_H,
                  background: item.preview ? `url(${item.preview})` : "#ddd",
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  borderRadius: 8,
                  border: selectedId === item.id ? "2px solid #5b5bd6" : "1px solid #d0d0d0",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
                  cursor: "pointer",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    left: 8,
                    bottom: 6,
                    fontSize: 12,
                    color: "#333",
                    opacity: 0.6,
                    background: "rgba(255,255,255,0.7)",
                    padding: "2px 6px",
                    borderRadius: 4,
                  }}
                >
                  {item.name || "Scene"}
                </span>
              </button>
            )
          )}
        </div>

        {/* Next */}
        {canSlide && (
          <button
            onClick={() => setStart((s) => Math.min(total - VISIBLE, s + 1))}
            disabled={start >= total - VISIBLE}
            style={{
              position: "absolute",
              right: "calc(50% - 560px)",
              top: "50%",
              transform: "translateY(-50%)",
              width: BTN_SIZE, height: BTN_SIZE,
              borderRadius: "50%",
              border: "1px solid #cfcfe6",
              background: "#fff",
              boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 26, lineHeight: "1",
              cursor: start >= total - VISIBLE ? "not-allowed" : "pointer",
            }}
            aria-label="다음"
            title="다음"
          >
            ›
          </button>
        )}
      </section>
    </div>
  );
}