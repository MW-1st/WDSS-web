import React from "react";

const VISIBLE = 4;
const BTN_SIZE = 48;

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function SceneCarousel({
  scenes,
  selectedId,
  start,
  setStart,
  onAddScene,
  onSelectScene,
  /** 갤러리 열림 등으로 중앙이 좁아졌을 때 더 컴팩트하게 배치 */
  compact = false,
}) {
  const containerRef = React.useRef(null);

  // ✨ 반응형 크기 계산
  const [dims, setDims] = React.useState(() => ({
    thumbW: compact ? 200 : 220,
    thumbH: compact ? Math.round(200 * 0.6) : Math.round(220 * 0.6),
    gap: compact ? 24 : 48,
    leftBtnX: 0,
    rightBtnX: 0,
  }));

  // 크기 재계산 함수
  const recalc = React.useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const containerW = rect.width;

    // compact 일 때 더 작은 최소폭/간격
    const MIN_W = compact ? 160 : 200;
    const MAX_W = compact ? 220 : 240;
    const GAP = compact ? 24 : 48;

    // 중앙 썸네일 줄(4개)이 들어갈 수 있는 최대 폭을 기준으로 썸네일 너비 계산
    const maxThumbW = Math.floor((containerW - GAP * (VISIBLE - 1)) / VISIBLE);
    const thumbW = clamp(maxThumbW, MIN_W, MAX_W);
    const thumbH = Math.round(thumbW * 0.6);

    // 중앙 줄 전체 폭
    const stripW = thumbW * VISIBLE + GAP * (VISIBLE - 1);

    // 좌/우 버튼 x 오프셋(px) — 중앙 줄의 좌우 바깥쪽에 위치
    const sideSpace = Math.max(0, (containerW - stripW) / 2);
    const btnOffset = Math.max(0, sideSpace - BTN_SIZE - 8); // 8px 여유

    setDims({
      thumbW,
      thumbH,
      gap: GAP,
      leftBtnX: btnOffset,
      rightBtnX: btnOffset,
    });
  }, [compact]);

  // ResizeObserver로 반응형 처리
  React.useEffect(() => {
    recalc();
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => recalc());
    ro.observe(el);
    window.addEventListener("orientationchange", recalc);
    window.addEventListener("resize", recalc);
    return () => {
      ro.disconnect();
      window.removeEventListener("orientationchange", recalc);
      window.removeEventListener("resize", recalc);
    };
  }, [recalc]);

  // 갤러리 토글 같은 외부 요인이 바뀌면 재계산
  React.useEffect(() => {
    recalc();
  }, [compact, recalc]);

  const items = React.useMemo(
    () => [...scenes, { id: "__ADD__", isAdd: true }],
    [scenes]
  );
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
    <section
      ref={containerRef}
      style={{
        position: "relative",
        marginTop: 8,
        marginBottom: 72,
        // 썸네일 줄이 가운데 정렬되도록 컨테이너는 가로 100%
        width: "100%",
      }}
    >
      {/* Prev */}
      {canSlide && (
        <button
          onClick={() => setStart((s) => Math.max(0, s - 1))}
          disabled={start === 0}
          style={{
            position: "absolute",
            left: `${dims.leftBtnX}px`,
            top: "50%",
            transform: "translateY(-50%)",
            width: BTN_SIZE,
            height: BTN_SIZE,
            borderRadius: "50%",
            border: "1px solid #cfcfe6",
            background: "#fff",
            boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 26,
            lineHeight: "1",
            cursor: start === 0 ? "not-allowed" : "pointer",
            zIndex: 1,
          }}
          aria-label="이전"
          title="이전"
        >
          ‹
        </button>
      )}

      {/* 중앙 썸네일 묶음 */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: dims.gap,
        }}
      >
        {visibleItems.map((item) =>
          item.isAdd ? (
            <button
              key="__ADD__"
              onClick={onAddScene}
              aria-label="씬 추가하기"
              title="씬 추가하기"
              style={{
                width: dims.thumbW,
                height: dims.thumbH,
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
              title={item.name}
              style={{
                width: dims.thumbW,
                height: dims.thumbH,
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
            right: `${dims.rightBtnX}px`,
            top: "50%",
            transform: "translateY(-50%)",
            width: BTN_SIZE,
            height: BTN_SIZE,
            borderRadius: "50%",
            border: "1px solid #cfcfe6",
            background: "#fff",
            boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 26,
            lineHeight: "1",
            cursor:
              start >= total - VISIBLE ? "not-allowed" : "pointer",
            zIndex: 1,
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
