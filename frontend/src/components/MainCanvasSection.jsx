import React from "react";
import Canvas from "../components/Canvas.jsx";

function MainCanvasSection({
  selectedScene,
  projectId,
  imageUrl,
  stageRef,
  onChange,
  onPreviewChange,
  drawingMode,
  eraserSize,
  drawingColor,
  activeLayerId,
  onModeChange,
  onSelectionChange,
  onPanChange,
}) {
  return (
    <section
      style={{
        display: "flex",
        justifyContent: "center",
        padding: "24px 0 32px",
      }}
    >
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
              projectId={projectId}
              scene={selectedScene}
              width={1200}
              height={675}
              onChange={(patch) => onChange(selectedScene.id, patch)}
              onPreviewChange={onPreviewChange}
              imageUrl={imageUrl}
              stageRef={stageRef}
              drawingMode={drawingMode}
              eraserSize={eraserSize}
              drawingColor={drawingColor}
              activeLayerId={activeLayerId}
              onModeChange={onModeChange}
              onSelectionChange={onSelectionChange}
              onPanChange={onPanChange}
            />

          ) : (
            <div style={{ color: "#666", fontSize: 14 }}>
              아래 + 카드로 새 씬을 추가하세요
            </div>
          )}
        </div>
      </div>
    </section>
  );
}


export default React.memo(MainCanvasSection);
