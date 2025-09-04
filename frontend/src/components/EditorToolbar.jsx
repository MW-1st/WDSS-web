import React from "react";
import ImageTransformControls from "../components/ImageTransformControls.jsx";
import UnitySimulatorControls from "../components/UnitySimulatorControls.jsx";
import ImageGallery from "../components/ImageGallery.jsx";
import CanvasTools from "../components/CanvasTools.jsx";
import { FaImage } from "react-icons/fa";

export default function EditorToolbar({
  pid,
  selectedId,
  imageUrl,
  targetDots,
  setTargetDots,
  processing,
  onTransform,
  // Unity props
  isUnityVisible,
  showUnity,
  hideUnity,
  // ImageGallery props
  onImageDragStart,
  // Canvas props
  drawingMode,
  eraserSize,
  onModeChange,
  onClearAll,
  stageRef, // stageRef prop 추가
  layout = "full",
}) {
  const [showGallery, setShowGallery] = React.useState(true);
  const Inner = () => (
    <>
      <div style={{ marginBottom: 16 }}>
        {layout === "sidebar" && (
          <button
            onClick={() => setShowGallery((v) => !v)}
            title={showGallery ? "이미지 갤러리 닫기" : "이미지 갤러리 열기"}
            style={{
              border: "1px solid #ccc",
              padding: "8px 12px",
              borderRadius: 4,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              cursor: "pointer",
              background: "#f8f9fa",
              marginBottom: 8,
            }}
            aria-label="이미지 갤러리 토글"
          >
            <FaImage />
            <span style={{ fontSize: 14 }}>
              {showGallery ? "갤러리 숨기기" : "갤러리 열기"}
            </span>
          </button>
        )}
        {showGallery && <ImageGallery onImageDragStart={onImageDragStart} />}
      </div>

      <div style={{ marginBottom: 16 }}>
        <CanvasTools
          drawingMode={drawingMode}
          eraserSize={eraserSize}
          onModeChange={onModeChange}
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

  if (layout === "sidebar") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Inner />
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
        <Inner />
      </div>
    </section>
  );
}
