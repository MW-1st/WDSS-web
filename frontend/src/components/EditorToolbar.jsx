import React from "react";
import ImageTransformControls from "../components/ImageTransformControls.jsx";
import UnitySimulatorControls from "../components/UnitySimulatorControls.jsx";
import ImageGallery from "../components/ImageGallery.jsx";
import CanvasTools from "../components/CanvasTools.jsx";

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
  const Inner = () => (
    <>
      <h2
        style={{
          margin: 0,
          fontSize: 20,
          fontWeight: 700,
          marginBottom: 12,
        }}
      >
        프로젝트 이름
      </h2>

      <div style={{ marginBottom: 16 }}>
        <ImageGallery
          onImageDragStart={onImageDragStart}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <CanvasTools
          drawingMode={drawingMode}
          eraserSize={eraserSize}
          onModeChange={onModeChange}
          onClearAll={onClearAll}
        />
      </div>

      <div style={{ marginTop: 16 }}>
        <ImageTransformControls
          targetDots={targetDots}
          setTargetDots={setTargetDots}
          processing={processing}
          onTransform={onTransform}
          imageUrl={imageUrl}
          sceneId={selectedId}
          layout={layout}
          stageRef={stageRef} // stageRef prop 전달
        />
      </div>

      <UnitySimulatorControls
        isUnityVisible={isUnityVisible}
        showUnity={showUnity}
        hideUnity={hideUnity}
      />
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
