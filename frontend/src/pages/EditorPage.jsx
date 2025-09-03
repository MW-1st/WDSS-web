// src/pages/EditorPage.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import Canvas from "../components/Canvas.jsx";
import ImageUpload from "../components/ImageUpload.jsx";
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

  // --- 프로젝트가 없으면 생성하는 헬퍼 ---
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
      const saved = await api.put(`/api/projects/${pid}/scenes/${scene_id}`, {
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
      const created = await api.post(`/api/projects/${projectIdReady}/scenes`, {
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

      // 변환된 이미지 URL을 현재 씬에 저장
      if (selectedId && pid) {
        saveDebounced(selectedId, selectedScene?.drones, selectedScene?.preview, outputUrl);
      }
    } catch (e) {
      console.error("Transform error", e);
      alert("이미지 변환 중 오류가 발생했습니다.");
    } finally {
      setProcessing(false);
    }
  };

  // JSON 파일 생성 핸들러
  const handleCreateJson = async () => {
    try {
      if (!imageUrl || !imageUrl.endsWith(".svg")) {
        alert("먼저 변환하여 SVG를 생성해주세요.");
        return;
      }
      const resp = await fetch(imageUrl);
      const svgBlob = await resp.blob();
      const fd = new FormData();
      fd.append(
        "file",
        new File([svgBlob], "canvas.svg", { type: "image/svg+xml" })
      );
      const jsonResp = await client.post("/image/svg-to-json", fd);
      const jsonUrl = jsonResp.data?.json_url;
      const unitySent = jsonResp.data?.unity_sent;
      if (jsonUrl) {
        const base = client.defaults.baseURL?.replace(/\/$/, '') || '';
        const full = jsonUrl.startsWith('http')
          ? jsonUrl
          : `${base}/${jsonUrl.replace(/^\//,'')}`;
        window.open(full, '_blank', 'noopener');
        if (unitySent) {
          alert('JSON 파일이 생성되었고 Unity로 데이터가 전송되었습니다!');
        }
      } else {
        alert("JSON 생성에 실패했습니다.");
      }
    } catch (e) {
      console.error("SVG to JSON error", e);
      alert("JSON 생성 중 오류가 발생했습니다.");
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
      {/* 업로드 바 */}
      <section style={{ display: "flex", justifyContent: "center", padding: "24px 0", borderBottom: "1px solid #eee" }}>
        <div style={{ width: "70%", maxWidth: 980 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, marginBottom: 12 }}>이미지 업로드</h2>
          <ImageUpload
            projectId={pid ?? ""}
            sceneId={selectedId ?? ""}
            onUploaded={handleUploaded}
          />

          {/* 이미지 변환 컨트롤 */}
          {selectedId && (
            <div style={{ marginTop: 16, padding: 16, backgroundColor: "#f8f9fa", borderRadius: 8 }}>
              <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 12 }}>
                <label style={{ fontSize: 14, color: "#333", display: "flex", alignItems: "center", gap: 8 }}>
                  Target dots:
                  <span style={{ display: "inline-block", minWidth: "50px", textAlign: "right", fontWeight: "bold" }}>
                    {targetDots}
                  </span>
                </label>
                <input
                  type="range"
                  min={100}
                  max={10000}
                  step={100}
                  value={targetDots}
                  onChange={(e) => setTargetDots(parseInt(e.target.value, 10))}
                  style={{ flex: 1, maxWidth: 200 }}
                />
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  onClick={handleTransform}
                  disabled={processing || !imageUrl}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 4,
                    border: "none",
                    backgroundColor: processing || !imageUrl ? "#ccc" : "#007bff",
                    color: "white",
                    cursor: processing || !imageUrl ? "not-allowed" : "pointer",
                    fontSize: 14
                  }}
                >
                  {processing ? "변환 중..." : "변환"}
                </button>

                <button
                  onClick={handleCreateJson}
                  disabled={!imageUrl || !imageUrl.endsWith(".svg")}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 4,
                    border: "none",
                    backgroundColor: !imageUrl || !imageUrl.endsWith(".svg") ? "#ccc" : "#28a745",
                    color: "white",
                    cursor: !imageUrl || !imageUrl.endsWith(".svg") ? "not-allowed" : "pointer",
                    fontSize: 14
                  }}
                >
                  JSON 파일로 만들기
                </button>
              </div>
            </div>
          )}

          {/* Unity 기능 */}
          {selectedId && (
            <div style={{
              marginTop: 12,
              padding: 15,
              backgroundColor: "#f0f8ff",
              borderRadius: 8,
              border: "1px solid #e6f3ff"
            }}>
              <div style={{ marginBottom: 10 }}>
                {!isUnityVisible ? (
                  <button style={buttonStyle} onClick={showUnity}>
                    🎮 Unity 시뮬레이터 열기
                  </button>
                ) : (
                  <button style={closeButtonStyle} onClick={hideUnity}>
                    🎮 Unity 시뮬레이터 닫기
                  </button>
                )}
              </div>
              <p style={{ fontSize: 12, color: '#666', margin: 0 }}>
                Unity 시뮬레이터를 열고 'JSON 파일로만들기' 버튼을 클릭하면 Unity로 데이터가 자동 전송됩니다.
              </p>
            </div>
          )}
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
                imageUrl={imageUrl}
                stageRef={stageRef}
                onChange={(patch) => handleSceneChange(selectedScene.id, patch)}
              />
            ) : (
              <div style={{ color: "#666", fontSize: 14 }}>
                아래 + 카드로 새 씬을 추가하세요
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 하단 트랙: 씬 썸네일 */}
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