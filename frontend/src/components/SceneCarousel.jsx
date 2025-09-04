import React from "react";

const VISIBLE = 4;
const THUMB_W = 200;
const THUMB_H = 120;
const GAP = 48;
const BTN_SIZE = 48;

function SceneCarousel({
  scenes,
  selectedId,
  start,
  setStart,
  onAddScene,
  onSelectScene,
}) {
  const items = [...scenes, { id: "__ADD__", isAdd: true }];
  const total = items.length;
  const canSlide = total > VISIBLE;
  const end = Math.min(start + VISIBLE, total);
  const visibleItems = items.slice(start, end);

  const handleSelect = (id) => {
    if (id === "__ADD__") return;
    onSelectScene(id);
    const idx = items.findIndex((it) => it.id === id);
    if (idx < start) setStart(idx);
    if (idx >= start + VISIBLE) setStart(idx - VISIBLE + 1);
  };

  return (
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
              onClick={onAddScene}
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
  );
}

export default React.memo(SceneCarousel);
