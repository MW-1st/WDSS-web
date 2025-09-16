import React from "react";
import { createPortal } from "react-dom"; // 툴팁 렌더링
import ImageTransformControls from "../components/ImageTransformControls.jsx";
import UnitySimulatorControls from "../components/UnitySimulatorControls.jsx";
import { FaImage, FaPen, FaPaintBrush, FaEraser, FaRegTrashAlt } from "react-icons/fa";
import "../styles/CanvasTools.css";

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
  onGalleryStateChange,
  galleryOpen = false,
  isSceneTransformed,
  isToolAllowed,
}) => {
  const [galleryHovered, setGalleryHovered] = React.useState(false);
  const [galleryTooltipPos, setGalleryTooltipPos] = React.useState({ top: 0, left: 0 });
  const galleryBtnRef = React.useRef(null);

  const [toolHovered, setToolHovered] = React.useState(null);
  const drawToolRef = React.useRef(null);
  const eraseRef = React.useRef(null);
  const pixelEraseRef = React.useRef(null);
  const clearRef = React.useRef(null);
  const [toolTooltipPos, setToolTooltipPos] = React.useState({ top: 0, left: 0 });

  const toggleGallery = () => {
    onGalleryStateChange?.((prev) => !prev);
  };

  // 갤러리 버튼 툴팁 위치 계산
  React.useEffect(() => {
    if (!galleryHovered) return;
    const el = galleryBtnRef.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      setGalleryTooltipPos({
        top: Math.round(r.top + r.height / 2),
        left: Math.round(r.right + 8),
      });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [galleryHovered]);

  const getAnchorRef = (key) => {
    switch (key) {
      case "drawTool":
        return drawToolRef;
      case "erase":
        return eraseRef;
      case "pixelErase":
        return pixelEraseRef;
      case "clear":
        return clearRef;
      default:
        return null;
    }
  };

  // 도구 툴팁 위치 계산
  React.useEffect(() => {
    if (!toolHovered) return;
    const ref = getAnchorRef(toolHovered);
    const el = ref?.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      setToolTooltipPos({
        top: Math.round(r.top + r.height / 2),
        left: Math.round(r.right + 8),
      });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [toolHovered]);

  // 단축키: P(draw/brush), E(erase), V(select)
  React.useEffect(() => {
    const handler = (e) => {
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
        const targetMode = isSceneTransformed ? "brush" : "draw";
        onModeChange && onModeChange(targetMode);
      } else if (key === "e") {
        e.preventDefault();
        onModeChange && onModeChange("erase");
      } else if (key === "v") {
        e.preventDefault();
        onModeChange && onModeChange("select");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onModeChange, isSceneTransformed]);

  // 툴팁 텍스트
  const getToolTooltipText = (mode) => {
    switch (mode) {
      case "drawTool":
        return isSceneTransformed
          ? "브러쉬 도구 (P): 변환된 씬에서 자유롭게 그리기"
          : "펜 도구 (P): 변환 전 씬에서 선 그리기";
      case "erase":
        return "지우개 (E): 객체 또는 선을 지우기";
      case "pixelErase":
        return "픽셀 지우개: 세밀하게 픽셀 단위로 지우기";
      case "clear":
        return "전체 삭제: 현재 캔버스 내용을 모두 지우기";
      default:
        return "";
    }
  };

  const resolveModeForPermission = (mode) => {
    if (mode === "drawTool") {
      return isSceneTransformed ? "brush" : "draw";
    }
    return mode;
  };

  const isModeAllowed = (mode) => {
    const resolved = resolveModeForPermission(mode);
    return typeof isToolAllowed === "function" ? isToolAllowed(resolved) : true;
  };

  const getButtonClasses = (mode) => {
    const isActive =
      mode === "drawTool"
        ? drawingMode === "draw" || drawingMode === "brush"
        : drawingMode === mode;
    return `tool-button${isActive ? " active" : ""}`;
  };

  const handleDrawToolClick = () => {
    const targetMode = isSceneTransformed ? "brush" : "draw";
    if (!isModeAllowed(targetMode)) return;
    onModeChange?.(targetMode);
  };

  const handleModeButtonClick = (mode) => {
    if (!isModeAllowed(mode)) return;
    onModeChange?.(mode);
  };

  const handleClearClick = () => {
    if (!isModeAllowed("clear")) return;
    onClearAll?.();
  };

  const handleNativeColorChange = (e) => {
    const newColor = e.target.value;
    onColorChange?.(newColor);
  };

  // 갤러리 툴팁
  const GalleryTooltip = () =>
    galleryHovered
      ? createPortal(
          <div
            style={{
              position: "fixed",
              top: galleryTooltipPos.top,
              left: galleryTooltipPos.left,
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

  // 도구 툴팁
  const ToolTooltipPortal = () =>
    toolHovered
      ? createPortal(
          <div
            className="tooltip"
            style={{ top: toolTooltipPos.top, left: toolTooltipPos.left }}
          >
            {getToolTooltipText(toolHovered)}
          </div>,
          document.body
        )
      : null;

  return (
    <>
      {layout === "sidebar" && (
        <div className="tool-anchor">
          <button
            ref={galleryBtnRef}
            onClick={toggleGallery}
            aria-label="이미지 갤러리 열기"
            onMouseEnter={() => setGalleryHovered(true)}
            onMouseLeave={() => setGalleryHovered(false)}
            className={`tool-button${galleryOpen ? " active" : ""}`}
            data-open={galleryOpen ? "true" : "false"}
            title="Image gallery"
          >
            <FaImage size={20} />
          </button>
          <GalleryTooltip />
        </div>
      )}

      <div className="canvas-tools-container">
        <div
          ref={drawToolRef}
          className="tool-anchor"
          onMouseEnter={() => setToolHovered("drawTool")}
          onMouseLeave={() => setToolHovered(null)}
        >
          <button
            onClick={handleDrawToolClick}
            className={getButtonClasses("drawTool")}
            aria-label={isSceneTransformed ? "브러쉬 도구" : "펜 도구"}
            disabled={!isModeAllowed("drawTool")}
          >
            {isSceneTransformed ? <FaPaintBrush /> : <FaPen />}
          </button>
        </div>

        <div className="tool-anchor color-picker-group">
          <div className="color-picker-wrapper">
            <input
              type="color"
              value={drawingColor}
              onChange={handleNativeColorChange}
              className="square-color-picker"
              aria-label="색상 선택"
              title={drawingColor}
            />
          </div>
        </div>

        <div
          ref={eraseRef}
          className="tool-anchor"
          onMouseEnter={() => setToolHovered("erase")}
          onMouseLeave={() => setToolHovered(null)}
        >
          <button
            onClick={() => handleModeButtonClick("erase")}
            className={getButtonClasses("erase")}
            aria-label="지우개 도구"
            disabled={!isModeAllowed("erase")}
          >
            <FaEraser />
          </button>
        </div>

        <div
          ref={pixelEraseRef}
          className="tool-anchor"
          onMouseEnter={() => setToolHovered("pixelErase")}
          onMouseLeave={() => setToolHovered(null)}
        >
          <button
            onClick={() => handleModeButtonClick("pixelErase")}
            className={getButtonClasses("pixelErase")}
            aria-label="픽셀 지우개"
            disabled={!isModeAllowed("pixelErase")}
          >
            <FaEraser />
          </button>
        </div>

        <div
          ref={clearRef}
          className="tool-anchor"
          onMouseEnter={() => setToolHovered("clear")}
          onMouseLeave={() => setToolHovered(null)}
        >
          <button
            onClick={handleClearClick}
            className="tool-button clear-button"
            aria-label="전체 삭제"
            title="현재 캔버스의 모든 내용을 삭제합니다"
            disabled={!isModeAllowed("clear")}
          >
            <FaRegTrashAlt />
          </button>
        </div>

        <ToolTooltipPortal />
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
      <div
        className="editor-sidebar"
        style={{ display: "flex", flexDirection: "column", gap: 16 }}
      >
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
