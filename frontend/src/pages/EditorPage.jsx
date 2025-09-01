// src/pages/EditorPage.jsx
import React, { useMemo, useState } from "react";
import Canvas from "../components/Canvas.jsx";
import ImageUpload from "../components/ImageUpload.jsx";

const VISIBLE = 4;
const THUMB_W = 200;
const THUMB_H = 120;
const GAP = 48;
const BTN_SIZE = 48; // ← 넘기는 버튼 크기

export default function EditorPage({ projectId = 1 }) {
  const [scenes, setScenes] = useState([]); // [{id, name, data, preview}]
  const [selectedId, setSelectedId] = useState(null);
  const [start, setStart] = useState(0);

  const selectedScene = useMemo(
    () => scenes.find((s) => s.id === selectedId) || null,
    [scenes, selectedId]
  );

  // 항상 마지막에 붙는 "+ 카드"
  const items = useMemo(() => [...scenes, { id: "__ADD__", isAdd: true }], [scenes]);
  const total = items.length;

  const canSlide = total > VISIBLE;
  const end = Math.min(start + VISIBLE, total);
  const visibleItems = items.slice(start, end);

  const prev = () => setStart((s) => Math.max(0, s - 1));
  const next = () => setStart((s) => Math.min(total - VISIBLE, s + 1));

  const handleAddScene = () => {
    const newId = scenes.length ? Math.max(...scenes.map((s) => s.id)) + 1 : 1;
    const newScene = { id: newId, name: `Scene ${newId}`, data: [], preview: null };
    const nextScenes = [...scenes, newScene];
    setScenes(nextScenes);
    setSelectedId(newId);
    const nextTotal = nextScenes.length + 1; // +카드 포함
    if (nextTotal > VISIBLE) setStart(nextTotal - VISIBLE);
  };

  const handleSelect = (id) => {
    if (id === "__ADD__") return;
    setSelectedId(id);
    const idx = items.findIndex((it) => it.id === id);
    if (idx < start) setStart(idx);
    if (idx >= start + VISIBLE) setStart(idx - VISIBLE + 1);
  };

  const handleSceneChange = (id, patch) => {
    setScenes((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  return (
    <div style={{ width: "100%", background: "#fff" }}>
      {/* 업로드 바 */}
      <section style={{ display: "flex", justifyContent: "center", padding: "24px 0", borderBottom: "1px solid #eee" }}>
        <div style={{ width: "70%", maxWidth: 980 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, marginBottom: 12 }}></h2>
          <ImageUpload projectId={projectId} sceneId={selectedId ?? 0} />
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
              />
            ) : (
              <div style={{ color: "#666", fontSize: 14 }}>아래 + 버튼으로 새 씬을 추가하세요</div>
            )}
          </div>
        </div>
      </section>
{/* 하단: 썸네일 트랙 */}
<section style={{ position: "relative", marginTop: 32, marginBottom: 64 }}>
  {/* Prev 버튼: 왼쪽 바깥 */}
  {canSlide && (
    <button
      onClick={prev}
      disabled={start === 0}
      style={{
        position: "absolute",
        left: "calc(50% - 540px)", 
        top: "50%",
        transform: "translateY(-50%)",
        width: 48,
        height: 48,
        borderRadius: "50%",
        border: "1px solid #cfcfe6",
        background: "#fff",
        boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
        fontSize: 26,
        lineHeight: "1",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: start === 0 ? "not-allowed" : "pointer",
      }}
      aria-label="이전"
      title="이전"
    >
      ‹
    </button>
  )}

{/* 썸네일 묶음 */}
<div
  style={{
    display: "flex",
    justifyContent: "center",
    gap: 48,
  }}
>
  {visibleItems.map((item) =>
    item.isAdd ? (
      <button
        key="__ADD__"
        onClick={handleAddScene}
        style={{
          width: 200,
          height: 120,
          borderRadius: 8,
          border: "1px dashed #999",
          background: "#fff",
          fontSize: 28,
          color: "#666",
          cursor: "pointer",
        }}
      >
        +
      </button>
    ) : (
      <button
        key={item.id}
        onClick={() => handleSelect(item.id)}
        style={{
          width: 200,
          height: 120,
          background: item.preview ? `url(${item.preview})` : "#ddd",
          backgroundSize: "cover",
          backgroundPosition: "center",
          borderRadius: 8,
          border:
            selectedId === item.id
              ? "2px solid #5b5bd6"
              : "1px solid #d0d0d0",
          boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
          cursor: "pointer",
          position: "relative", // ← 라벨 absolute 배치
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
          {item.name}
        </span>
      </button>
    )
  )}
</div>


  {/* Next 버튼: 오른쪽 바깥 */}
  {canSlide && (
    <button
      onClick={next}
      disabled={start >= total - VISIBLE}
      style={{
        position: "absolute",
        right: "calc(50% - 540px)", // 썸네일 영역보다 살짝 바깥
        top: "50%",
        transform: "translateY(-50%)",
        width: 48,
        height: 48,
        borderRadius: "50%",
        border: "1px solid #cfcfe6",
        background: "#fff",
        boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
        fontSize: 26,
        lineHeight: "1",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor:
          start >= total - VISIBLE ? "not-allowed" : "pointer",
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
