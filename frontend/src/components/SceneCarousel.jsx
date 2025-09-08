import React from "react";
import { useParams } from "react-router-dom";
import client from "../api/client";
import { getImageUrl } from "../utils/imageUtils";
import { MdDelete } from "react-icons/md";

const VISIBLE = 4;
const BTN_SIZE = 48;

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export default React.memo(function SceneCarousel({
  projectId: projectIdProp,      // ?�선?�위 1
  scenes,                        // [{id, name, preview, project_id?}, ...]
  setScenes,
  selectedId,
  onSelectScene,
  start,
  setStart,
  onAddScene,
  compact = false,
}) {
  // URL ?�라미터 ?�선?�위 2 (????지??
  const { projectId: projectIdFromUrl, project_id: projectIdFromUrl2 } = useParams();

  // ?�에??추론 ?�선?�위 3
  const projectIdFromScenes = React.useMemo(() => {
    const found = scenes.find((s) => s.project_id || s.projectId);
    return found ? (found.project_id ?? found.projectId) : undefined;
  }, [scenes]);

  // 최종 projectId
  const projectId = projectIdProp ?? projectIdFromUrl ?? projectIdFromUrl2 ?? projectIdFromScenes;

  const containerRef = React.useRef(null);
  // Inline SVG backgrounds to center arrow glyphs inside round buttons
  const ARROW_COLOR = "%235b5bd6"; // encoded '#5b5bd6'
  const leftArrowBg = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' width='20' height='20'><path fill='none' stroke='${ARROW_COLOR}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' d='M15 6 L9 12 L15 18'/></svg>")`;
  const rightArrowBg = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' width='20' height='20'><path fill='none' stroke='${ARROW_COLOR}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' d='M9 6 L15 12 L9 18'/></svg>")`;

  const [dims, setDims] = React.useState(() => ({
    thumbW: compact ? 200 : 220,
    thumbH: compact ? Math.round(200 * 0.6) : Math.round(220 * 0.6),
    gap: compact ? 24 : 48,
    leftBtnX: 0,
    rightBtnX: 0,
  }));

  const recalc = React.useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const containerW = el.getBoundingClientRect().width;

    // Slightly smaller thumbnails to make room for external arrows
    const MIN_W = compact ? 170 : 200;
    const MAX_W = compact ? 230 : 260;
    const GAP = compact ? 22 : 36;

    // Reserve space for navigation buttons on both sides
    const RESERVED_SIDE = BTN_SIZE + 20; // px
    const innerW = Math.max(0, containerW - RESERVED_SIDE * 2);

    const maxThumbW = Math.floor((innerW - GAP * (VISIBLE - 1)) / VISIBLE);
    const thumbW = clamp(maxThumbW, MIN_W, MAX_W);
    const thumbH = Math.round(thumbW * 0.6);

    const stripW = thumbW * VISIBLE + GAP * (VISIBLE - 1);
    const sideSpace = Math.max(0, (containerW - stripW) / 2);
    // Place arrows just outside the thumbnail strip with small breathing room
    const btnOffset = Math.max(8, sideSpace - BTN_SIZE - 12);

    setDims({ thumbW, thumbH, gap: GAP, leftBtnX: btnOffset, rightBtnX: btnOffset });
  }, [compact]);

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

  React.useEffect(() => {
    recalc();
  }, [compact, recalc]);

  const items = React.useMemo(() => [...scenes, { id: "__ADD__", isAdd: true }], [scenes]);
  const total = items.length;
  const maxStart = Math.max(0, total - VISIBLE);
  const startClamped = clamp(start, 0, maxStart);
  const canSlide = total > VISIBLE;
  const end = Math.min(startClamped + VISIBLE, total);
  const visibleItems = items.slice(startClamped, end);

  const handleSelect = (id) => {
    if (id === "__ADD__") return;
    onSelectScene?.(id);
    const idx = items.findIndex((it) => it.id === id);
    if (idx < start) setStart(idx);
    if (idx >= start + VISIBLE) setStart(idx - VISIBLE + 1);
  };

  // ---------- ?�버 ?�신 ?�틸 (axios client ?�용) ----------
  const fetchScenes = async () => {
    if (!projectId) throw new Error("project_id가 비어?�습?�다");
    // Swagger: GET /projects/{project_id}/scenes/  (?�레?�링 ?�래??O)
    const { data } = await client.get(`/projects/${projectId}/scenes`);
    const mapped = Array.isArray(data)
      ? data.map((s, i) => ({
          id: s.id,
          name: s.name ?? s.title ?? `Scene ${s.scene_num ?? i + 1}`,
          preview: s.preview ?? s.preview_url ?? null,
          project_id: s.project_id ?? s.projectId ?? projectId,
        }))
      : [];
    setScenes(mapped);
    return mapped;
  };

  // Unified fetch that tolerates API shape and normalizes fields
  const fetchScenesNormalized = async () => {
    if (!projectId) throw new Error("project_id가 비어?�습?�다");
    const { data } = await client.get(`/projects/${projectId}/scenes`);
    const list = Array.isArray(data) ? data : (data?.scenes ?? []);
    const mapped = list.map((s, i) => ({
      ...s,
      id: s.id,
      name: s.name ?? s.title ?? `Scene ${s.scene_num ?? i + 1}`,
      preview: s.preview ?? s.preview_url ?? getImageUrl?.(s.s3_key) ?? null,
      imageUrl: getImageUrl?.(s.s3_key) ?? null,
      project_id: s.project_id ?? s.projectId ?? projectId,
    }));
    setScenes(mapped);
    return mapped;
  };

  const deleteSceneOnServer = async (sceneId) => {
    if (!projectId) throw new Error("project_id가 비어?�습?�다");
    // Swagger: DELETE /projects/{project_id}/scenes/{scene_id} (보통 ?�래??X)
    await client.delete(`/projects/${projectId}/scenes/${sceneId}`);
    return true;
  };
  // --------------------------------------------------------

  const pickNeighbor = (deletedId, list) => {
    if (!list || list.length === 0) return null;
    const idx = list.findIndex((s) => s.id === deletedId);
    if (idx === -1) return selectedId;
    return list[idx + 1]?.id ?? list[idx - 1]?.id ?? null;
  };

  const handleDeleteClick = async (e, item) => {
    e.stopPropagation();
    if (item.isAdd) return;

    if (!projectId) {
      alert("??��???�패?�습?�다.\n?�인: project_id가 비어?�습?�다.\n?�결: SceneCarousel??projectId�?prop?�로 ?�기거나, URL??/projects/:project_id ?�태�??�달?�세??");
      return;
    }

    if (!window.confirm(`"${item.name ?? "Scene"}" ?�을 ??��?�까??`)) return;

    try {
      // 1) ?�버???�제 ??��
      await deleteSceneOnServer(item.id);

      // 2) ??��????기�? ?�웃 ?�택 준�??�조???�에 계산)
      const neighbor = selectedId === item.id ? pickNeighbor(item.id, scenes) : selectedId;

      // 3) ?�버?�서 최신 목록 ?�시 받아??반영
      const newList = await fetchScenesNormalized();
      onSelectScene?.(neighbor && newList.some((x) => x.id === neighbor) ? neighbor : newList[0]?.id ?? null);

      // 4) start 보정 (�??�이??= ??개수 + ?�추가??1)
      const totalNext = newList.length + 1;
      const maxStart = Math.max(0, totalNext - VISIBLE);
      if (start > maxStart) setStart(maxStart);

    } catch (err) {
      const status = err?.response?.status;
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err.message ||
        "?????�는 ?�류";
      alert(
        [
          "??��???�패?�습?�다.",
          `?�인: ${status ? status + " " : ""}${msg}`,
          `?�인: project_id=${projectId}, scene_id=${item.id}`,
        ].join("\n")
      );
    }
  };

  const Thumb = ({ item }) => {
    const isSelected = selectedId === item.id;
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => handleSelect(item.id)}
        onKeyDown={(ev) => (ev.key === "Enter" || ev.key === " ") && handleSelect(item.id)}
        title={item.name}
        style={{
          width: dims.thumbW,
          height: dims.thumbH,
          background: item.preview ? `url(${item.preview})` : "#ddd",
          backgroundSize: "cover",
          backgroundPosition: "center",
          borderRadius: 8,
          border: isSelected ? "2px solid #5b5bd6" : "1px solid #d0d0d0",
          boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
          cursor: "pointer",
          position: "relative",
          overflow: "hidden",
          outline: "none",
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

        <button
          type="button"
          onClick={(e) => handleDeleteClick(e, item)}
          aria-label="????��"
          title="????��"
          style={{
            position: "absolute",
            top: 6,
            right: 6,
            width: 28,
            height: 28,
            borderRadius: 6,
            border: "1px solid #e4e4ef",
            background: "rgba(255,255,255,0.92)",
            boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 16,
            lineHeight: "1",
            cursor: "pointer",
          }}
        >\r\n          <MdDelete size={16} color="#6b7280" />\r\n        </button>
      </div>
    );
  };

  const NAV_PAD = (compact ? 40 : BTN_SIZE) + 18;

  return (
    <section
      ref={containerRef}
      style={{ position: "relative", marginTop: 8, marginBottom: 72, width: "100%" }}
    >
      {canSlide && (
        <button
          onClick={() => setStart((s) => Math.max(0, s - 1))}
          disabled={startClamped === 0}
          style={{
            position: "absolute",
            left: `${dims.leftBtnX}px`,
            top: "50%",
            transform: "translateY(-50%)",
            width: (compact ? 40 : BTN_SIZE),
            height: (compact ? 40 : BTN_SIZE),
            borderRadius: "50%",
            border: "1px solid #cfcfe6",
            background: "#fff",
            backgroundImage: leftArrowBg,
            backgroundRepeat: "no-repeat",
            backgroundPosition: "center",
            boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 26,
            lineHeight: "1",
            color: "transparent",
            cursor: startClamped === 0 ? "not-allowed" : "pointer",
            zIndex: 1,
          }}
          aria-label="?�전"
          title="?�전"
        >
          ??
        </button>
      )}

      <div style={{ display: "flex", justifyContent: "center", gap: dims.gap, paddingLeft: NAV_PAD, paddingRight: NAV_PAD }}>
        {visibleItems.map((item) =>
          item.isAdd ? (
            <button
              key="__ADD__"
              onClick={onAddScene}
              aria-label="??추�??�기"
              title="??추�??�기"
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
            <Thumb key={item.id} item={item} />
          )
        )}
      </div>

      {canSlide && (
        <button
          onClick={() => setStart((s) => Math.min(total - VISIBLE, s + 1))}
          disabled={startClamped >= total - VISIBLE}
          style={{
            position: "absolute",
            right: `${dims.rightBtnX}px`,
            top: "50%",
            transform: "translateY(-50%)",
            width: (compact ? 40 : BTN_SIZE),
            height: (compact ? 40 : BTN_SIZE),
            borderRadius: "50%",
            border: "1px solid #cfcfe6",
            background: "#fff",
            backgroundImage: rightArrowBg,
            backgroundRepeat: "no-repeat",
            backgroundPosition: "center",
            boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 26,
            lineHeight: "1",
            color: "transparent",
            cursor: startClamped >= total - VISIBLE ? "not-allowed" : "pointer",
            zIndex: 1,
          }}
          aria-label="?�음"
          title="?�음"
        >
          ??
        </button>
      )}
    </section>
  );
});


