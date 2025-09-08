import React from "react";
import { createPortal } from "react-dom"; // 툴팁만 사용
import ImageTransformControls from "../components/ImageTransformControls.jsx";
import UnitySimulatorControls from "../components/UnitySimulatorControls.jsx";
import CanvasTools from "../components/CanvasTools.jsx";
import { FaImage } from "react-icons/fa";
import PortalPopover from "./PortalPopover.jsx"; 
const Inner = ({
  onImageDragStart,
  drawingMode,
  eraserSize,
  drawingColor,
  onModeChange,
  onColorChange,
  onColorPreview,
  onClearAll,
  targetDots,
  setTargetDots,
  processing,
  onTransform,
  imageUrl,
  selectedId,
  layout,
  stageRef,
  isUnityVisible,
  showUnity,
  hideUnity,
  onGalleryStateChange, // 부모에서 상태 관리
}) => {
  // 🔸 로컬에서 열림여부를 갖지 않고, 부모에게 토글만 알림
  const [galleryHovered, setGalleryHovered] = React.useState(false);
  const [tooltipPos, setTooltipPos] = React.useState({ top: 0, left: 0 });
  const btnRef = React.useRef(null);

  const toggleGallery = () => {
    // 부모가 상태를 소유하므로 이전값을 받아 토글
    onGalleryStateChange?.((prev) => !prev);
  };

  React.useEffect(() => {
    if (!galleryHovered) return;
    const el = btnRef.current; if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      setTooltipPos({ top: Math.round(r.top + r.height / 2), left: Math.round(r.right + 8) });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [galleryHovered]);

  // Keyboard shortcuts for tool switching: P(draw), E(erase), B(brush), V(select)
  React.useEffect(() => {
    const handler = (e) => {
      // Ignore when typing into inputs/textareas/contenteditables
      const target = e.target;
      const isTyping =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (isTyping) return;

      const key = e.key?.toLowerCase();
      if (key === "p") {
        e.preventDefault();
        onModeChange && onModeChange("draw");
      } else if (key === "e") {
        e.preventDefault();
        onModeChange && onModeChange("erase");
      } else if (key === "b") {
        e.preventDefault();
        onModeChange && onModeChange("brush");
      } else if (key === "v") {
        e.preventDefault();
        onModeChange && onModeChange("select");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onModeChange]);

  // Keyboard shortcuts for tool switching: P(draw), E(erase), B(brush), V(select)
  React.useEffect(() => {
    const handler = (e) => {
      // Ignore when typing into inputs/textareas/contenteditables
      const target = e.target;
      const isTyping =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (isTyping) return;

      const key = e.key?.toLowerCase();
      if (key === "p") {
        e.preventDefault();
        onModeChange && onModeChange("draw");
      } else if (key === "e") {
        e.preventDefault();
        onModeChange && onModeChange("erase");
      } else if (key === "b") {
        e.preventDefault();
        onModeChange && onModeChange("brush");
      } else if (key === "v") {
        e.preventDefault();
        onModeChange && onModeChange("select");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onModeChange]);

  const Tooltip = () =>
    galleryHovered
      ? createPortal(
          <div
            style={{
              position: "fixed",
              top: tooltipPos.top,
              left: tooltipPos.left,
              transform: "translateY(-50%)",
              background: "#000",
              color: "#fff",
              padding: "6px 8px",
              borderRadius: 6,
              fontSize: 12,
              whiteSpace: "nowrap",
              zIndex: 9999,
              pointerEvents: "none",
              boxShadow: "0 2px 6px rgba(0,0,0,.2)",
            }}
          >
            Image gallery
          </div>,
          document.body
        )
      : null;

  return (
    <>
      {layout === "sidebar" && (
        <div style={{ marginBottom: 8 }}>
          <button
            ref={btnRef}
            onClick={toggleGallery}
            aria-label="Image gallery"
            onMouseEnter={() => setGalleryHovered(true)}
            onMouseLeave={() => setGalleryHovered(false)}
            style={{
              border: "1px solid #ccc",
              padding: "8px 16px",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 16,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "#f8f9fa",
            }}
          >
            <FaImage />
          </button>
          <Tooltip />
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <CanvasTools
          drawingMode={drawingMode}
          eraserSize={eraserSize}
          drawingColor={drawingColor}
          onModeChange={onModeChange}
          onColorChange={onColorChange}
          onColorPreview={onColorPreview}
          onClearAll={onClearAll}
        />
      </div>

      {layout !== "sidebar" && (
        <>
          <div style={{ marginTop: 16 }}>
            <ImageTransformControls
              targetDots={targetDots}
              setTargetDots={setTargetDots}
              processing={processing}
              onTransform={onTransform}
              imageUrl={imageUrl}
              sceneId={selectedId}
              layout={layout}
              stageRef={stageRef}
            />
          </div>

          <UnitySimulatorControls
            isUnityVisible={isUnityVisible}
            showUnity={showUnity}
            hideUnity={hideUnity}
          />
        </>
      )}
    </>
  );
};

const EditorToolbar = React.memo(function EditorToolbar(props) {
  const { layout = "full" } = props;
  if (layout === "sidebar") {
    return (
      <div className="editor-sidebar" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Inner {...props} />
      </div>
    );
  }
  return (
    <section
      style={{
        display: "flex",
        justifyContent: "center",
        padding: "24px 0",
        borderBottom: "1px solid #eee",
      }}
    >
      <div style={{ width: "70%", maxWidth: 980 }}>
        <Inner {...props} />
      </div>
    </section>
  );
});

export default EditorToolbar;
